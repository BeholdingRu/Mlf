-- Run once in the Supabase SQL editor to enable calorie-norm adaptation.
-- Re-running is safe if the first version of this migration added only the flag.
alter table public.profiles
  add column if not exists calorie_adaptation_enabled boolean not null default false,
  add column if not exists calorie_adaptation_baseline_weight numeric(6, 1),
  add column if not exists calorie_adaptation_baseline_on date;

-- Exact dates of older calorie-norm edits were not stored. Use the configured
-- starting weight (or the earliest measurement) as the legacy baseline.
update public.profiles as profile
set
  calorie_adaptation_baseline_weight = coalesce(
    profile.calorie_adaptation_baseline_weight,
    profile.target_weight,
    (
      select weight.value
      from public.weight_logs as weight
      where weight.user_id = profile.id
      order by weight.logged_on, weight.id
      limit 1
    )
  ),
  calorie_adaptation_baseline_on = coalesce(
    profile.calorie_adaptation_baseline_on,
    profile.weight_started_on,
    (
      select weight.logged_on
      from public.weight_logs as weight
      where weight.user_id = profile.id
      order by weight.logged_on, weight.id
      limit 1
    ),
    current_date
  )
where profile.daily_calories_norm is not null
  and (
    profile.calorie_adaptation_baseline_weight is null
    or profile.calorie_adaptation_baseline_on is null
  );

alter table public.profiles
  drop constraint if exists profiles_calorie_adaptation_baseline_weight_check;
alter table public.profiles
  add constraint profiles_calorie_adaptation_baseline_weight_check
  check (
    calorie_adaptation_baseline_weight is null
    or calorie_adaptation_baseline_weight > 0
  );
