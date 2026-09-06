-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
alter table public.tasks
  add column if not exists withdrawal_syndrome boolean not null default false,
  add column if not exists withdrawal_started_on date,
  add column if not exists withdrawal_restart_on date;
