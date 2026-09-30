-- Run once in the Supabase SQL editor to enable inverted logic for regular tasks.
alter table public.tasks
  add column if not exists inverted_logic boolean not null default false;

update public.tasks
set inverted_logic = false
where withdrawal_syndrome = true
  and inverted_logic = true;

alter table public.tasks
  drop constraint if exists tasks_withdrawal_inverted_logic_check;
alter table public.tasks
  add constraint tasks_withdrawal_inverted_logic_check
  check (not (withdrawal_syndrome and inverted_logic));

create or replace function public.prevent_marked_inverted_task_logic_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  user_today date;
begin
  if new.inverted_logic is distinct from old.inverted_logic then
    select timezone(coalesce(nullif(profile.time_zone, ''), 'Europe/Moscow'), now())::date
    into user_today
    from public.profiles as profile
    where profile.id = old.user_id;

    user_today := coalesce(user_today, timezone('Europe/Moscow', now())::date);

    if exists (
      select 1
      from public.task_completions as completion
      where completion.task_id = old.id
        and completion.completed_on = user_today
    ) then
      raise exception 'Инверсию логики нельзя изменить после отметки задачи за сегодня';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_marked_inverted_task_logic_change on public.tasks;
create trigger prevent_marked_inverted_task_logic_change
before update of inverted_logic on public.tasks
for each row
execute function public.prevent_marked_inverted_task_logic_change();
