-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
-- Хранит последнюю открытую пользователем книгу и главу Библии.

alter table public.profiles
  add column if not exists last_bible_book_order smallint
    check (last_bible_book_order between 1 and 66),
  add column if not exists last_bible_chapter smallint
    check (last_bible_chapter >= 1);
