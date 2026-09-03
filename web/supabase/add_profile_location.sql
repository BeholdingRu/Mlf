-- Run this in the Supabase SQL editor for an existing MLF database.
-- Stores the time zone and city coordinates needed to calculate Friday sunsets.

alter table public.profiles
  add column if not exists time_zone text,
  add column if not exists city_name text,
  add column if not exists city_latitude numeric(7, 4),
  add column if not exists city_longitude numeric(7, 4);
