-- Run once in the Supabase SQL editor for databases that previously required
-- a registration access code. New users can then sign up without extra
-- metadata or a database-side access-code check.

drop trigger if exists validate_registration_access_before_create on auth.users;
drop function if exists public.validate_registration_access();
drop function if exists public.is_valid_registration_code(text);
drop table if exists public.registration_access_codes;

-- Keep profile creation independent from the former alpha-test metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  insert into public.mindfulness_categories (user_id, name)
  values (new.id, 'Субботняя школа'), (new.id, 'Неотсортированные')
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;
