-- Run once in the Supabase SQL editor to save personal names for bookmark colors.
alter table public.profiles
  add column if not exists bible_bookmark_color_labels jsonb not null default '{}'::jsonb
    check (jsonb_typeof(bible_bookmark_color_labels) = 'object');
