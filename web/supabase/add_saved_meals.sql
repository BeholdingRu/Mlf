-- Run once in the Supabase SQL editor to store reusable meals.
-- Each JSON item keeps the saved product id and its weight; nutrition stays live in saved_products.
create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  items jsonb not null check (
    case
      when jsonb_typeof(items) = 'array'
        then jsonb_array_length(items) between 1 and 100
      else false
    end
  ),
  created_at timestamptz not null default now()
);

create unique index if not exists saved_meals_user_name_unique_idx
  on public.saved_meals (user_id, lower(trim(name)));

create index if not exists saved_meals_user_created_idx
  on public.saved_meals (user_id, created_at);

alter table public.saved_meals enable row level security;

revoke all on table public.saved_meals from anon;
grant select, insert, update, delete on table public.saved_meals to authenticated;

drop policy if exists "saved_meals_all_own" on public.saved_meals;
create policy "saved_meals_all_own" on public.saved_meals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.saved_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  planned_on date not null,
  saved_meal_ids jsonb not null check (
    jsonb_typeof(saved_meal_ids) = 'array'
    and jsonb_array_length(saved_meal_ids) between 1 and 100
  ),
  created_at timestamptz not null default now()
);

create index if not exists saved_meal_plans_user_date_idx
  on public.saved_meal_plans (user_id, planned_on, created_at);

alter table public.saved_meal_plans enable row level security;
revoke all on table public.saved_meal_plans from anon;
grant select, insert, update, delete on table public.saved_meal_plans to authenticated;

drop policy if exists "saved_meal_plans_all_own" on public.saved_meal_plans;
create policy "saved_meal_plans_all_own" on public.saved_meal_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
