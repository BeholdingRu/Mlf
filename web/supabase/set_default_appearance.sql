-- Run once in the Supabase SQL editor for an existing MLF database.
-- Changes defaults for newly created profiles without overwriting the choices
-- already saved by existing users.

alter table public.profiles
  alter column theme set default 'dark-gruvbox',
  alter column interface_style set default 'style-1';
