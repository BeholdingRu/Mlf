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
  double_volume boolean not null default false,
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
  add column if not exists double_volume boolean not null default false,
  add column if not exists weight_kg numeric(7, 1) check (weight_kg >= 0),
  add column if not exists repetitions integer check (repetitions > 0),
  add column if not exists sets integer check (sets > 0),
  add column if not exists rest_duration text check (rest_duration is null or rest_duration ~ '^\d+:[0-5][0-9]$'),
  add column if not exists parameters_locked boolean not null default false,
  add column if not exists completed boolean not null default false;

with normalized_order as (
  select
    exercise.id,
    (row_number() over (
      partition by exercise.user_id, exercise.planned_on
      order by exercise.sort_order, exercise.created_at, exercise.id
    ) - 1)::integer as sort_order
  from public.scheduled_exercises as exercise
)
update public.scheduled_exercises as exercise
set sort_order = normalized_order.sort_order
from normalized_order
where exercise.id = normalized_order.id
  and exercise.sort_order <> normalized_order.sort_order;

create index if not exists scheduled_exercises_user_date_order_idx
  on public.scheduled_exercises (user_id, planned_on, sort_order);

alter table public.scheduled_exercises enable row level security;

drop policy if exists "scheduled_exercises_all_own" on public.scheduled_exercises;
create policy "scheduled_exercises_all_own" on public.scheduled_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep reordering atomic so an interrupted request cannot leave two exercises
-- with partially swapped positions.
create or replace function public.swap_scheduled_exercise_order(
  first_exercise_id uuid,
  second_exercise_id uuid
)
returns setof public.scheduled_exercises
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  first_exercise public.scheduled_exercises%rowtype;
  second_exercise public.scheduled_exercises%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform 1
  from public.scheduled_exercises as exercise
  where exercise.id in (first_exercise_id, second_exercise_id)
    and exercise.user_id = current_user_id
  order by exercise.id
  for update;

  select exercise.* into first_exercise
  from public.scheduled_exercises as exercise
  where exercise.id = first_exercise_id
    and exercise.user_id = current_user_id;

  select exercise.* into second_exercise
  from public.scheduled_exercises as exercise
  where exercise.id = second_exercise_id
    and exercise.user_id = current_user_id;

  if first_exercise.id is null or second_exercise.id is null then
    raise exception 'Scheduled exercise not found';
  end if;
  if first_exercise.planned_on <> second_exercise.planned_on then
    raise exception 'Exercises must belong to the same date';
  end if;

  update public.scheduled_exercises as exercise
  set sort_order = case
    when exercise.id = first_exercise.id then second_exercise.sort_order
    else first_exercise.sort_order
  end
  where exercise.id in (first_exercise.id, second_exercise.id)
    and exercise.user_id = current_user_id;

  return query
  select exercise.*
  from public.scheduled_exercises as exercise
  where exercise.id in (first_exercise.id, second_exercise.id)
    and exercise.user_id = current_user_id;
end;
$$;

revoke all on function public.swap_scheduled_exercise_order(uuid, uuid) from public, anon;
grant execute on function public.swap_scheduled_exercise_order(uuid, uuid) to authenticated;
