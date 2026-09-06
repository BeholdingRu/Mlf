-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
-- Роли хранятся отдельно от профиля, а клиент не имеет прав их менять.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

revoke all on table public.user_roles from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'nick-p-89@mail.ru'
on conflict (user_id) do update set role = excluded.role;
