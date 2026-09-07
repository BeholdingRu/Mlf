-- Create date-specific planned meal entries, separate from actual daily consumption.
create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  planned_on date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  product_name text not null check (char_length(trim(product_name)) > 0),
  weight_grams numeric(8, 1) not null check (weight_grams > 0),
  calories_per_100g numeric(6, 2) not null check (calories_per_100g > 0),
  proteins_per_100g numeric(6, 2) not null default 0 check (proteins_per_100g >= 0),
  fats_per_100g numeric(6, 2) not null default 0 check (fats_per_100g >= 0),
  carbohydrates_per_100g numeric(6, 2) not null default 0 check (carbohydrates_per_100g >= 0),
  created_at timestamptz not null default now()
);

-- Support installations where the first planner migration was already applied.
alter table public.meal_plan_entries
  add column if not exists planned_on date;

update public.meal_plan_entries
set planned_on = current_date
where planned_on is null;

alter table public.meal_plan_entries
  alter column planned_on set not null;

drop index if exists public.meal_plan_entries_user_meal_idx;
create index if not exists meal_plan_entries_user_date_meal_idx
  on public.meal_plan_entries (user_id, planned_on, meal_type, created_at);

alter table public.meal_plan_entries enable row level security;

drop policy if exists "meal_plan_entries_all_own" on public.meal_plan_entries;
create policy "meal_plan_entries_all_own" on public.meal_plan_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
