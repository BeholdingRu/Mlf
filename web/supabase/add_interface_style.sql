-- Run once in the Supabase SQL editor to store the interface style separately
-- from the selected color scheme.
alter table public.profiles
  add column if not exists interface_style text not null default 'style-1';

alter table public.profiles
  alter column interface_style set default 'style-1';

alter table public.profiles
  drop constraint if exists profiles_interface_style_check;
alter table public.profiles
  add constraint profiles_interface_style_check
  check (interface_style in ('default', 'style-1', 'style-2'));
