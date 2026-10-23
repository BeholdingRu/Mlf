-- Run once in the Supabase SQL editor for an existing MLF database.
-- Makes the renamed Nebosvod theme the default and migrates removed themes.

update public.profiles
set shabbat_theme = 'shabbat-soft'
where shabbat_theme in ('shabbat-gold', 'shabbat-dawn');

alter table public.profiles
  alter column shabbat_theme set default 'shabbat-soft';
