-- Run once in the Supabase SQL editor to enable personal Bible bookmarks.
create table if not exists public.bible_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_order smallint not null check (book_order between 1 and 66),
  chapter smallint not null check (chapter > 0),
  verse smallint not null check (verse > 0),
  title text not null check (char_length(trim(title)) between 1 and 160),
  color text not null default '#fff2a8' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (user_id, book_order, chapter, verse)
);

create index if not exists bible_bookmarks_user_created_idx
  on public.bible_bookmarks (user_id, created_at desc);

alter table public.bible_bookmarks enable row level security;

drop policy if exists "bible_bookmarks_all_own" on public.bible_bookmarks;
create policy "bible_bookmarks_all_own" on public.bible_bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
