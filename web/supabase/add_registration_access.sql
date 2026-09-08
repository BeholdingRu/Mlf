-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
-- Код регистрации хранится в виде SHA-256-хеша и не доступен клиентскому приложению.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.registration_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.registration_access_codes (code_hash)
values ('eb8301c77dfc545320efd372a93c94d6c4c4b6e0cdfc89b301d5fdba5abd9cd3')
on conflict (code_hash) do nothing;

alter table public.profiles
  add column if not exists alpha_test_consent_at timestamptz;

create or replace function public.is_valid_registration_code(candidate_code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.registration_access_codes
    where is_active
      and code_hash = encode(extensions.digest(trim(candidate_code), 'sha256'), 'hex')
  );
$$;

create or replace function public.validate_registration_access()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  registration_code text;
begin
  registration_code := new.raw_user_meta_data ->> 'registration_code';

  if not public.is_valid_registration_code(registration_code) then
    raise exception 'Неверный код регистрации';
  end if;

  if coalesce(new.raw_user_meta_data ->> 'alpha_test_consent', 'false') <> 'true' then
    raise exception 'Необходимо подтвердить согласие на участие в альфа-тестировании';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    - 'registration_code'
    - 'alpha_test_consent';
  return new;
end;
$$;

drop trigger if exists validate_registration_access_before_create on auth.users;
create trigger validate_registration_access_before_create
  before insert on auth.users
  for each row execute procedure public.validate_registration_access();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, alpha_test_consent_at)
  values (new.id, coalesce(new.email, ''), now())
  on conflict (id) do nothing;
  insert into public.mindfulness_categories (user_id, name)
  values (new.id, 'Субботняя школа'), (new.id, 'Неотсортированные')
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

alter table public.registration_access_codes enable row level security;
revoke all on table public.registration_access_codes from anon, authenticated;
revoke all on function public.is_valid_registration_code(text) from public;
grant execute on function public.is_valid_registration_code(text) to anon, authenticated;
