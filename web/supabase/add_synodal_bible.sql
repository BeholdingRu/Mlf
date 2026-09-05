-- Выполните этот файл в Supabase SQL Editor перед импортом текста Библии.
-- Таблица содержит только текст стихов Синодального перевода (RST).
create table if not exists public.bible_verses (
  id bigint generated always as identity primary key,
  book_code text not null,
  book_name text not null,
  book_order smallint not null check (book_order between 1 and 66),
  chapter smallint not null check (chapter > 0),
  verse smallint not null check (verse > 0),
  text text not null check (char_length(trim(text)) > 0),
  unique (book_code, chapter, verse)
);

create index if not exists bible_verses_book_chapter_verse_idx
  on public.bible_verses (book_order, chapter, verse);

alter table public.bible_verses enable row level security;

drop policy if exists "bible_verses_read" on public.bible_verses;
create policy "bible_verses_read" on public.bible_verses
  for select to anon, authenticated using (true);
