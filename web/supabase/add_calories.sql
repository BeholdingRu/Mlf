-- Add daily_calories_norm to profiles table
alter table public.profiles
add column daily_calories_norm numeric(6, 1);

-- Create daily_food_logs table for tracking consumed food
create table if not exists public.daily_food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  product_name text not null,
  weight_grams numeric(8, 1) not null check (weight_grams > 0),
  calories_per_100g numeric(6, 2) not null check (calories_per_100g > 0),
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_on_idx on public.daily_food_logs (user_id, logged_on desc);

-- Enable RLS
alter table public.daily_food_logs enable row level security;

-- Add policies
drop policy if exists "food_logs_all_own" on public.daily_food_logs;
create policy "food_logs_all_own" on public.daily_food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
