-- Run (or rerun after an application update) in the Supabase SQL editor.
-- Preserves the final calorie norm for each day and administrator overrides.
create table if not exists public.calorie_norm_history (
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_on date not null,
  daily_calories_norm numeric(6, 1),
  daily_calories_norm_override numeric(6, 1),
  calorie_adaptation_enabled boolean not null default false,
  calorie_adaptation_baseline_weight numeric(6, 1),
  calorie_adaptation_baseline_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, effective_on),
  check (daily_calories_norm is null or daily_calories_norm > 0),
  check (
    calorie_adaptation_baseline_weight is null
    or calorie_adaptation_baseline_weight > 0
  )
);

alter table public.calorie_norm_history
  add column if not exists daily_calories_norm_override numeric(6, 1);

alter table public.calorie_norm_history
  drop constraint if exists calorie_norm_history_daily_calories_norm_override_check;
alter table public.calorie_norm_history
  add constraint calorie_norm_history_daily_calories_norm_override_check
  check (daily_calories_norm_override is null or daily_calories_norm_override > 0);

create or replace function public.profile_local_date(
  selected_time_zone text,
  selected_instant timestamptz default now()
)
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return timezone(
    coalesce(nullif(selected_time_zone, ''), 'Europe/Moscow'),
    selected_instant
  )::date;
exception
  when invalid_parameter_value then
    return timezone('Europe/Moscow', selected_instant)::date;
end;
$$;

create or replace function public.record_calorie_norm_history()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_time_zone text;
  effective_date date;
begin
  selected_time_zone := new.time_zone;
  effective_date := public.profile_local_date(selected_time_zone, now());

  insert into public.calorie_norm_history (
    user_id,
    effective_on,
    daily_calories_norm,
    daily_calories_norm_override,
    calorie_adaptation_enabled,
    calorie_adaptation_baseline_weight,
    calorie_adaptation_baseline_on,
    updated_at
  )
  values (
    new.id,
    effective_date,
    new.daily_calories_norm,
    null,
    new.calorie_adaptation_enabled,
    new.calorie_adaptation_baseline_weight,
    new.calorie_adaptation_baseline_on,
    now()
  )
  on conflict (user_id, effective_on) do update
  set
    daily_calories_norm = excluded.daily_calories_norm,
    daily_calories_norm_override = null,
    calorie_adaptation_enabled = excluded.calorie_adaptation_enabled,
    calorie_adaptation_baseline_weight = excluded.calorie_adaptation_baseline_weight,
    calorie_adaptation_baseline_on = excluded.calorie_adaptation_baseline_on,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists record_calorie_norm_history_after_change on public.profiles;
create trigger record_calorie_norm_history_after_change
  after update of
    daily_calories_norm,
    calorie_adaptation_enabled,
    calorie_adaptation_baseline_weight,
    calorie_adaptation_baseline_on
  on public.profiles
  for each row execute function public.record_calorie_norm_history();

-- Exact timestamps of earlier edits are unavailable. The latest saved
-- baseline date is the closest reliable effective date for the current norm.
insert into public.calorie_norm_history (
  user_id,
  effective_on,
  daily_calories_norm,
  calorie_adaptation_enabled,
  calorie_adaptation_baseline_weight,
  calorie_adaptation_baseline_on
)
select
  profile.id,
  coalesce(
    profile.calorie_adaptation_baseline_on,
    public.profile_local_date(profile.time_zone, now())
  ),
  profile.daily_calories_norm,
  profile.calorie_adaptation_enabled,
  profile.calorie_adaptation_baseline_weight,
  profile.calorie_adaptation_baseline_on
from public.profiles as profile
where profile.daily_calories_norm is not null
on conflict (user_id, effective_on) do nothing;

alter table public.calorie_norm_history enable row level security;

revoke all on table public.calorie_norm_history from anon;
grant select, insert, update on table public.calorie_norm_history to authenticated;

drop policy if exists "calorie_norm_history_all_own" on public.calorie_norm_history;
create policy "calorie_norm_history_all_own" on public.calorie_norm_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
