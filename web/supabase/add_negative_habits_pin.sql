-- Run once in the Supabase SQL editor to protect negative habits with a PIN.
alter table public.profiles
  add column if not exists negative_habits_pin text,
  add column if not exists negative_habits_pin_required boolean not null default true;

-- Existing users with withdrawal-syndrome tasks receive the initial PIN 0000.
update public.profiles as profile
set negative_habits_pin = '0000'
where profile.negative_habits_pin is null
  and exists (
    select 1
    from public.tasks as task
    where task.user_id = profile.id
      and task.withdrawal_syndrome = true
  );

alter table public.profiles
  drop constraint if exists profiles_negative_habits_pin_check;
alter table public.profiles
  add constraint profiles_negative_habits_pin_check
  check (negative_habits_pin is null or negative_habits_pin ~ '^[0-9]{4}$');
