-- Run once in the Supabase SQL editor to save diary statistics targets.
-- Values are stored with the rest of the user's personal settings.
alter table public.profiles
  add column if not exists diary_statistics_targets jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_diary_statistics_targets_check;
alter table public.profiles
  add constraint profiles_diary_statistics_targets_check
  check (jsonb_typeof(diary_statistics_targets) = 'object');
