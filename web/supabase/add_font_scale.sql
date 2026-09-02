-- Выполните этот запрос в Supabase SQL Editor для существующего проекта.
alter table public.profiles
  add column if not exists font_scale numeric(3, 2) not null default 1
  check (font_scale in (0.9, 1, 1.1, 1.2));
