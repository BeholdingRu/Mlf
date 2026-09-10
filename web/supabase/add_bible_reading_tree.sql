-- Run once in the Supabase SQL editor to enable the Bible reading tree.
-- Each unique chapter opened during the user's local day is counted once.
create table if not exists public.bible_chapter_reads (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_on date not null,
  book_order smallint not null check (book_order between 1 and 66),
  chapter smallint not null check (chapter > 0),
  opened_at timestamptz not null default now(),
  unique (user_id, read_on, book_order, chapter)
);

create table if not exists public.bible_tree_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  progress_steps smallint not null default 0 check (progress_steps between 0 and 334),
  started_on date not null,
  last_processed_on date not null,
  updated_at timestamptz not null default now()
);

create index if not exists bible_chapter_reads_user_date_idx
  on public.bible_chapter_reads (user_id, read_on);

alter table public.bible_chapter_reads enable row level security;
alter table public.bible_tree_progress enable row level security;

drop policy if exists "bible_chapter_reads_all_own" on public.bible_chapter_reads;
create policy "bible_chapter_reads_all_own" on public.bible_chapter_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bible_tree_progress_all_own" on public.bible_tree_progress;
create policy "bible_tree_progress_all_own" on public.bible_tree_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.bible_progress_local_date()
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  selected_time_zone text;
  local_date date;
begin
  select coalesce(nullif(profiles.time_zone, ''), 'Europe/Moscow')
    into selected_time_zone
  from public.profiles
  where profiles.id = auth.uid();

  selected_time_zone := coalesce(selected_time_zone, 'Europe/Moscow');

  begin
    local_date := timezone(selected_time_zone, now())::date;
  exception when invalid_parameter_value then
    local_date := timezone('Europe/Moscow', now())::date;
  end;

  return local_date;
end;
$$;

create or replace function public.refresh_bible_tree_progress()
returns table (
  progress_steps integer,
  chapters_today integer,
  started_on date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  today date;
  progress_row public.bible_tree_progress%rowtype;
  processing_date date;
  chapter_count integer;
  next_progress integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  today := public.bible_progress_local_date();

  select progress.*
    into progress_row
  from public.bible_tree_progress as progress
  where progress.user_id = current_user_id
  for update;

  if not found then
    return query
      select
        0,
        count(*)::integer,
        null::date
      from public.bible_chapter_reads as reads
      where reads.user_id = current_user_id
        and reads.read_on = today;
    return;
  end if;

  next_progress := progress_row.progress_steps;
  processing_date := progress_row.last_processed_on + 1;

  while processing_date < today loop
    select count(*)::integer
      into chapter_count
    from public.bible_chapter_reads as reads
    where reads.user_id = current_user_id
      and reads.read_on = processing_date;

    if chapter_count >= 5 then
      next_progress := least(334, next_progress + 1);
    else
      next_progress := greatest(0, next_progress - 1);
    end if;

    processing_date := processing_date + 1;
  end loop;

  if progress_row.last_processed_on < today - 1 then
    update public.bible_tree_progress as progress
    set
      progress_steps = next_progress,
      last_processed_on = today - 1,
      updated_at = now()
    where progress.user_id = current_user_id;
  end if;

  select count(*)::integer
    into chapter_count
  from public.bible_chapter_reads as reads
  where reads.user_id = current_user_id
    and reads.read_on = today;

  return query
    select next_progress, chapter_count, progress_row.started_on;
end;
$$;

create or replace function public.record_bible_chapter_read(
  p_book_order smallint,
  p_chapter smallint
)
returns table (
  progress_steps integer,
  chapters_today integer,
  started_on date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  today date;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_book_order not between 1 and 66 or p_chapter < 1 then
    raise exception 'Invalid Bible chapter';
  end if;

  today := public.bible_progress_local_date();

  insert into public.bible_tree_progress (
    user_id,
    progress_steps,
    started_on,
    last_processed_on
  )
  values (
    current_user_id,
    0,
    today,
    today - 1
  )
  on conflict (user_id) do nothing;

  insert into public.bible_chapter_reads (
    user_id,
    read_on,
    book_order,
    chapter
  )
  values (
    current_user_id,
    today,
    p_book_order,
    p_chapter
  )
  on conflict (user_id, read_on, book_order, chapter) do nothing;

  return query
    select *
    from public.refresh_bible_tree_progress();
end;
$$;

revoke all on function public.bible_progress_local_date() from public;
revoke all on function public.refresh_bible_tree_progress() from public;
revoke all on function public.record_bible_chapter_read(smallint, smallint) from public;

grant execute on function public.bible_progress_local_date() to authenticated;
grant execute on function public.refresh_bible_tree_progress() to authenticated;
grant execute on function public.record_bible_chapter_read(smallint, smallint) to authenticated;
