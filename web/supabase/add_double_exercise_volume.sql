-- Удвоение объёма для упражнений, где руки или ноги работают поочерёдно.
-- Настройка копируется из каталога в запланированное упражнение.
alter table public.saved_exercises
  add column if not exists double_volume boolean not null default false;

alter table public.scheduled_exercises
  add column if not exists double_volume boolean not null default false;

create or replace function public.sync_saved_exercise_double_volume()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.double_volume is distinct from old.double_volume then
    update public.scheduled_exercises
    set double_volume = new.double_volume
    where user_id = old.user_id
      and category = old.category
      and exercise_name = old.name;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_saved_exercise_double_volume_after_update on public.saved_exercises;
create trigger sync_saved_exercise_double_volume_after_update
  after update of double_volume on public.saved_exercises
  for each row execute function public.sync_saved_exercise_double_volume();
