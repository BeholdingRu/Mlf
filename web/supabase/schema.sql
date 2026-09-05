-- MLF: run this in the Supabase SQL editor (once per project).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  weight_enabled boolean not null default false,
  target_weight numeric(6, 1),
  desired_weight numeric(6, 1),
  weight_started_on date,
  daily_calories_norm numeric(6, 1),
  theme text not null default 'green',
  font_scale numeric(3, 2) not null default 1 check (font_scale in (0.9, 1, 1.1, 1.2)),
  time_zone text,
  city_name text,
  city_latitude numeric(7, 4),
  city_longitude numeric(7, 4),
  shabbat_enabled boolean not null default false,
  shabbat_theme text not null default 'shabbat-dawn',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists theme text not null default 'green';

alter table public.profiles
  add column if not exists font_scale numeric(3, 2) not null default 1
  check (font_scale in (0.9, 1, 1.1, 1.2));

alter table public.profiles
  add column if not exists time_zone text,
  add column if not exists city_name text,
  add column if not exists city_latitude numeric(7, 4),
  add column if not exists city_longitude numeric(7, 4),
  add column if not exists shabbat_enabled boolean not null default false,
  add column if not exists shabbat_theme text not null default 'shabbat-dawn';

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  habit_days integer not null default 21 check (habit_days >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_on date not null,
  unique (task_id, completed_on)
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  value numeric(6, 1) not null,
  logged_on date not null,
  unique (user_id, logged_on)
);

create table if not exists public.path_day_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cycle_started_on date not null,
  day text not null check (day in ('saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  created_at timestamptz not null default now(),
  unique (user_id, cycle_started_on, day)
);

create table if not exists public.course_lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id text not null,
  lesson_number integer not null check (lesson_number > 0),
  created_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_number)
);

create table if not exists public.mindfulness_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  content text not null check (char_length(trim(content)) between 1 and 7000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  product_name text not null,
  weight_grams numeric(8, 1) not null check (weight_grams > 0),
  calories_per_100g numeric(6, 2) not null check (calories_per_100g > 0),
  proteins_per_100g numeric(6, 2) not null default 0 check (proteins_per_100g >= 0),
  fats_per_100g numeric(6, 2) not null default 0 check (fats_per_100g >= 0),
  carbohydrates_per_100g numeric(6, 2) not null default 0 check (carbohydrates_per_100g >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  calories_per_100g numeric(6, 2) not null check (calories_per_100g > 0),
  proteins_per_100g numeric(6, 2) not null default 0 check (proteins_per_100g >= 0),
  fats_per_100g numeric(6, 2) not null default 0 check (fats_per_100g >= 0),
  carbohydrates_per_100g numeric(6, 2) not null default 0 check (carbohydrates_per_100g >= 0),
  is_favorite boolean not null default false,
  category text not null default 'Мясо и мясные продукты' check (category in (
    'Мясо и мясные продукты', 'Рыба и морепродукты', 'Молочные продукты и яйца',
    'Овощи, зелень, грибы', 'Фрукты и ягоды', 'Крупы, макаронные изделия и мука',
    'Хлебобулочные изделия', 'Бобовые и орехи', 'Масла, жиры и соусы',
    'Готовые блюда и фастфуд', 'Напитки'
  )),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.saved_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  category text not null check (category in ('Спина', 'Грудь', 'Плечи', 'Руки', 'Ноги', 'Кор')),
  exercise_type text not null default 'Свободные веса / в блоке'
    check (exercise_type in ('Свободные веса / в блоке', 'Собственный вес')),
  rest_timer_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, category, name)
);

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

create index if not exists tasks_user_id_idx on public.tasks (user_id, sort_order);
create index if not exists completions_user_on_idx on public.task_completions (user_id, completed_on);
create index if not exists completions_task_on_idx on public.task_completions (task_id, completed_on);
create index if not exists weight_logs_user_on_idx on public.weight_logs (user_id, logged_on desc);
create index if not exists path_day_confirmations_user_cycle_idx on public.path_day_confirmations (user_id, cycle_started_on);
create index if not exists course_lesson_completions_user_course_idx on public.course_lesson_completions (user_id, course_id);
create index if not exists mindfulness_notes_user_updated_idx on public.mindfulness_notes (user_id, updated_at desc);
create index if not exists food_logs_user_on_idx on public.daily_food_logs (user_id, logged_on desc);
create index if not exists saved_products_user_name_idx on public.saved_products (user_id, name);
create index if not exists saved_exercises_user_category_name_idx on public.saved_exercises (user_id, category, name);
create index if not exists scheduled_exercises_user_date_order_idx on public.scheduled_exercises (user_id, planned_on, sort_order);

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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.weight_logs enable row level security;
alter table public.path_day_confirmations enable row level security;
alter table public.course_lesson_completions enable row level security;
alter table public.mindfulness_notes enable row level security;
alter table public.daily_food_logs enable row level security;
alter table public.saved_products enable row level security;
alter table public.saved_exercises enable row level security;
alter table public.scheduled_exercises enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "tasks_all_own" on public.tasks;
create policy "tasks_all_own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "completions_all_own" on public.task_completions;
create policy "completions_all_own" on public.task_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weight_logs_all_own" on public.weight_logs;
create policy "weight_logs_all_own" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "path_day_confirmations_all_own" on public.path_day_confirmations;
create policy "path_day_confirmations_all_own" on public.path_day_confirmations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "course_lesson_completions_all_own" on public.course_lesson_completions;
create policy "course_lesson_completions_all_own" on public.course_lesson_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mindfulness_notes_all_own" on public.mindfulness_notes;
create policy "mindfulness_notes_all_own" on public.mindfulness_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "food_logs_all_own" on public.daily_food_logs;
create policy "food_logs_all_own" on public.daily_food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_products_all_own" on public.saved_products;
create policy "saved_products_all_own" on public.saved_products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_exercises_all_own" on public.saved_exercises;
create policy "saved_exercises_all_own" on public.saved_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scheduled_exercises_all_own" on public.scheduled_exercises;
create policy "scheduled_exercises_all_own" on public.scheduled_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
