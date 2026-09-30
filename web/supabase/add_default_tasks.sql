-- Run once in the Supabase SQL editor to give built-in tasks stable identities.
-- Existing matching tasks are linked without changing their titles or history.
alter table public.tasks
  add column if not exists task_kind text,
  add column if not exists bible_daily_chapter_target integer;

alter table public.tasks
  drop constraint if exists tasks_task_kind_check;
alter table public.tasks
  add constraint tasks_task_kind_check
  check (task_kind is null or task_kind in ('nutrition', 'bible_reading'));

alter table public.tasks
  drop constraint if exists tasks_bible_daily_chapter_target_check;
alter table public.tasks
  add constraint tasks_bible_daily_chapter_target_check
  check (bible_daily_chapter_target is null or bible_daily_chapter_target >= 1);

update public.tasks
set
  task_kind = null,
  bible_daily_chapter_target = null
where withdrawal_syndrome = true
  and task_kind is not null;

alter table public.tasks
  drop constraint if exists tasks_default_kind_regular_check;
alter table public.tasks
  add constraint tasks_default_kind_regular_check
  check (not withdrawal_syndrome or task_kind is null);

with nutrition_candidates as (
  select
    task.id,
    row_number() over (
      partition by task.user_id
      order by task.sort_order, task.created_at, task.id
    ) as candidate_number
  from public.tasks as task
  where task.task_kind is null
    and task.withdrawal_syndrome = false
    and lower(regexp_replace(btrim(task.title), '\s*:\s*', ':', 'g')) = 'телостроительство:питание'
    and not exists (
      select 1
      from public.tasks as linked_task
      where linked_task.user_id = task.user_id
        and linked_task.task_kind = 'nutrition'
    )
)
update public.tasks as task
set task_kind = 'nutrition'
from nutrition_candidates as candidate
where candidate.id = task.id
  and candidate.candidate_number = 1;

with bible_candidates as (
  select
    task.id,
    row_number() over (
      partition by task.user_id
      order by task.sort_order, task.created_at, task.id
    ) as candidate_number
  from public.tasks as task
  where task.task_kind is null
    and task.withdrawal_syndrome = false
    and regexp_replace(lower(btrim(task.title)), '\s+', ' ', 'g')
      ~ '^(чтение библии|чтение бибили)($|[[:space:]]|:|—|-)'
    and not exists (
      select 1
      from public.tasks as linked_task
      where linked_task.user_id = task.user_id
        and linked_task.task_kind = 'bible_reading'
    )
)
update public.tasks as task
set
  task_kind = 'bible_reading',
  bible_daily_chapter_target = coalesce(task.bible_daily_chapter_target, 5)
from bible_candidates as candidate
where candidate.id = task.id
  and candidate.candidate_number = 1;

update public.tasks
set bible_daily_chapter_target = 5
where task_kind = 'bible_reading'
  and bible_daily_chapter_target is null;

-- Built-in tasks always use regular completion semantics. Temporarily suspend
-- the same-day edit guard while converting an older matching inverted task;
-- the history trigger remains active and records the switch for statistics.
do $$
declare
  logic_guard_state text;
begin
  select trigger_row.tgenabled
  into logic_guard_state
  from pg_trigger as trigger_row
  where trigger_row.tgrelid = 'public.tasks'::regclass
    and trigger_row.tgname = 'prevent_marked_inverted_task_logic_change'
    and not trigger_row.tgisinternal;

  if logic_guard_state is not null and logic_guard_state <> 'D' then
    alter table public.tasks disable trigger prevent_marked_inverted_task_logic_change;
  end if;

  begin
    update public.tasks
    set inverted_logic = false
    where task_kind in ('nutrition', 'bible_reading')
      and inverted_logic = true;
  exception
    when others then
      case logic_guard_state
        when 'A' then alter table public.tasks enable always trigger prevent_marked_inverted_task_logic_change;
        when 'R' then alter table public.tasks enable replica trigger prevent_marked_inverted_task_logic_change;
        when 'O' then alter table public.tasks enable trigger prevent_marked_inverted_task_logic_change;
        else null;
      end case;
      raise;
  end;

  case logic_guard_state
    when 'A' then alter table public.tasks enable always trigger prevent_marked_inverted_task_logic_change;
    when 'R' then alter table public.tasks enable replica trigger prevent_marked_inverted_task_logic_change;
    when 'O' then alter table public.tasks enable trigger prevent_marked_inverted_task_logic_change;
    else null;
  end case;
end;
$$;

alter table public.tasks
  drop constraint if exists tasks_default_kind_inverted_logic_check;
alter table public.tasks
  add constraint tasks_default_kind_inverted_logic_check
  check (task_kind is null or inverted_logic = false);

create unique index if not exists tasks_user_task_kind_unique
  on public.tasks (user_id, task_kind)
  where task_kind is not null;

-- Keep the tree's server-side daily history capped at five unique chapters.
-- Higher task goals are tracked locally by the web client.
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
  chapter_count integer;
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

  perform 1
  from public.bible_tree_progress as progress
  where progress.user_id = current_user_id
  for update;

  select count(*)::integer
    into chapter_count
  from public.bible_chapter_reads as reads
  where reads.user_id = current_user_id
    and reads.read_on = today;

  if chapter_count < 5 then
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
  end if;

  return query
    select *
    from public.refresh_bible_tree_progress();
end;
$$;

revoke all on function public.record_bible_chapter_read(smallint, smallint) from public;
grant execute on function public.record_bible_chapter_read(smallint, smallint) to authenticated;
