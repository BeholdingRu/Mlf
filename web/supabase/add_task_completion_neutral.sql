-- Run once in the Supabase SQL editor.
-- A neutral completion preserves a day without increasing or reducing task progress.
alter table public.task_completions
  add column if not exists progress_neutral boolean not null default false;
