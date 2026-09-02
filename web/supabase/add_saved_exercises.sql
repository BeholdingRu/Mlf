-- Личный каталог упражнений пользователя по группам мышц.
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

alter table public.saved_exercises
  add column if not exists exercise_type text not null default 'Свободные веса / в блоке'
    check (exercise_type in ('Свободные веса / в блоке', 'Собственный вес')),
  add column if not exists rest_timer_enabled boolean not null default true;

alter table public.saved_exercises
  alter column rest_timer_enabled set default true;

create index if not exists saved_exercises_user_category_name_idx
  on public.saved_exercises (user_id, category, name);

alter table public.saved_exercises enable row level security;

drop policy if exists "saved_exercises_all_own" on public.saved_exercises;
create policy "saved_exercises_all_own" on public.saved_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
