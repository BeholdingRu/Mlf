-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
-- Хранит включение ежегодного цикла в настройках Шаббата.

alter table public.profiles
  add column if not exists annual_cycle_enabled boolean not null default false;
