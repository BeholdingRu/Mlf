-- Run this in the Supabase SQL editor for an existing MLF database.
-- Stores whether the Shabbat appearance and Friday sunset time are enabled.

alter table public.profiles
  add column if not exists shabbat_enabled boolean not null default false,
  add column if not exists shabbat_theme text not null default 'shabbat-dawn';
