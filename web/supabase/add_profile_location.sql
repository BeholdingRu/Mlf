-- Run (or rerun after an application update) in the Supabase SQL editor.
-- The user selects only a time zone. A representative city and its coordinates
-- are derived automatically for sunset calculations.

alter table public.profiles
  add column if not exists time_zone text default 'Europe/Moscow',
  add column if not exists city_name text default 'Москва',
  add column if not exists city_latitude numeric(7, 4) default 55.7558,
  add column if not exists city_longitude numeric(7, 4) default 37.6173;

alter table public.profiles
  alter column time_zone set default 'Europe/Moscow',
  alter column city_name set default 'Москва',
  alter column city_latitude set default 55.7558,
  alter column city_longitude set default 37.6173;

create or replace function public.apply_profile_time_zone_location()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.time_zone := coalesce(nullif(new.time_zone, ''), 'Europe/Moscow');

  case new.time_zone
    when 'Europe/Kaliningrad' then
      new.city_name := 'Калининград';
      new.city_latitude := 54.7104;
      new.city_longitude := 20.4522;
    when 'Europe/Moscow' then
      new.city_name := 'Москва';
      new.city_latitude := 55.7558;
      new.city_longitude := 37.6173;
    when 'Europe/Samara' then
      new.city_name := 'Самара';
      new.city_latitude := 53.1959;
      new.city_longitude := 50.1002;
    when 'Asia/Yekaterinburg' then
      new.city_name := 'Екатеринбург';
      new.city_latitude := 56.8389;
      new.city_longitude := 60.6057;
    when 'Asia/Omsk' then
      new.city_name := 'Омск';
      new.city_latitude := 54.9885;
      new.city_longitude := 73.3242;
    when 'Asia/Krasnoyarsk' then
      new.city_name := 'Красноярск';
      new.city_latitude := 56.0153;
      new.city_longitude := 92.8932;
    when 'Asia/Irkutsk' then
      new.city_name := 'Иркутск';
      new.city_latitude := 52.2864;
      new.city_longitude := 104.3050;
    when 'Asia/Yakutsk' then
      new.city_name := 'Якутск';
      new.city_latitude := 62.0355;
      new.city_longitude := 129.6755;
    when 'Asia/Vladivostok' then
      new.city_name := 'Владивосток';
      new.city_latitude := 43.1155;
      new.city_longitude := 131.8855;
    when 'Asia/Magadan' then
      new.city_name := 'Магадан';
      new.city_latitude := 59.5612;
      new.city_longitude := 150.8301;
    when 'Asia/Kamchatka' then
      new.city_name := 'Петропавловск-Камчатский';
      new.city_latitude := 53.0370;
      new.city_longitude := 158.6559;
    else
      new.time_zone := 'Europe/Moscow';
      new.city_name := 'Москва';
      new.city_latitude := 55.7558;
      new.city_longitude := 37.6173;
  end case;

  return new;
end;
$$;

drop trigger if exists apply_profile_time_zone_location_before_write on public.profiles;
create trigger apply_profile_time_zone_location_before_write
  before insert or update on public.profiles
  for each row execute function public.apply_profile_time_zone_location();

-- Rewriting the zone runs the trigger and normalizes every existing profile,
-- including profiles that previously used a different city in the same zone.
update public.profiles
set time_zone = coalesce(nullif(time_zone, ''), 'Europe/Moscow');

alter table public.profiles
  alter column time_zone set not null,
  alter column city_name set not null,
  alter column city_latitude set not null,
  alter column city_longitude set not null;

alter table public.profiles
  drop constraint if exists profiles_time_zone_check;
alter table public.profiles
  add constraint profiles_time_zone_check
  check (time_zone in (
    'Europe/Kaliningrad',
    'Europe/Moscow',
    'Europe/Samara',
    'Asia/Yekaterinburg',
    'Asia/Omsk',
    'Asia/Krasnoyarsk',
    'Asia/Irkutsk',
    'Asia/Yakutsk',
    'Asia/Vladivostok',
    'Asia/Magadan',
    'Asia/Kamchatka'
  ));

revoke all on function public.apply_profile_time_zone_location() from public, anon, authenticated;
