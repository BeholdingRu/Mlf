-- Выполните этот файл в Supabase SQL Editor после add_mindfulness_notes.sql.
create table if not exists public.mindfulness_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.mindfulness_notes
  add column if not exists category_id uuid references public.mindfulness_categories (id) on delete restrict;

insert into public.mindfulness_categories (user_id, name)
select id, category_name
from public.profiles
cross join (values ('Субботняя школа'::text), ('Неотсортированные'::text)) as categories(category_name)
on conflict (user_id, name) do nothing;

update public.mindfulness_notes notes
set category_id = categories.id
from public.mindfulness_categories categories
where notes.category_id is null
  and categories.user_id = notes.user_id
  and categories.name = 'Неотсортированные';

alter table public.mindfulness_notes
  alter column category_id set not null;

create index if not exists mindfulness_categories_user_created_idx
  on public.mindfulness_categories (user_id, created_at);

alter table public.mindfulness_categories enable row level security;

drop policy if exists "mindfulness_categories_all_own" on public.mindfulness_categories;
create policy "mindfulness_categories_all_own" on public.mindfulness_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.create_default_mindfulness_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mindfulness_categories (user_id, name)
  values (new.id, 'Субботняя школа'), (new.id, 'Неотсортированные')
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_mindfulness_categories on public.profiles;
create trigger on_profile_created_mindfulness_categories
  after insert on public.profiles
  for each row execute procedure public.create_default_mindfulness_categories();
