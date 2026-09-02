-- Запланированные упражнения. Данные упражнения копируются в план,
-- поэтому удаление из каталога не влияет на уже составленные тренировки.
create table if not exists public.scheduled_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  planned_on date not null,
  exercise_name text not null check (char_length(trim(exercise_name)) > 0),
  category text not null check (category in ('Спина', 'Грудь', 'Плечи', 'Руки', 'Ноги', 'Кор')),
  exercise_type text not null check (exercise_type in ('Свободные веса / в блоке', 'Собственный вес')),
  rest_timer_enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  weight_kg numeric(7, 1) check (weight_kg >= 0),
  repetitions integer check (repetitions > 0),
  sets integer check (sets > 0),
  rest_duration text check (rest_duration is null or rest_duration ~ '^\d+:[0-5][0-9]$'),
  parameters_locked boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.scheduled_exercises
  add column if not exists weight_kg numeric(7, 1) check (weight_kg >= 0),
  add column if not exists repetitions integer check (repetitions > 0),
  add column if not exists sets integer check (sets > 0),
  add column if not exists rest_duration text check (rest_duration is null or rest_duration ~ '^\d+:[0-5][0-9]$'),
  add column if not exists parameters_locked boolean not null default false,
  add column if not exists completed boolean not null default false;

create index if not exists scheduled_exercises_user_date_order_idx
  on public.scheduled_exercises (user_id, planned_on, sort_order);

alter table public.scheduled_exercises enable row level security;

drop policy if exists "scheduled_exercises_all_own" on public.scheduled_exercises;
create policy "scheduled_exercises_all_own" on public.scheduled_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
