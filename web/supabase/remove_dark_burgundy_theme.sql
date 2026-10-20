-- Run once in the Supabase SQL editor after removing the dark burgundy theme.
-- Existing users of the removed theme are moved to the default Retro theme.
update public.profiles
set theme = 'dark-gruvbox'
where theme = 'dark-blue';
