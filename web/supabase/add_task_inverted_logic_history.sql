-- Run once in the Supabase SQL editor so task statistics keep the logic
-- that was active on each date instead of applying the current mode to all history.
alter table public.tasks
  add column if not exists inverted_logic_history jsonb not null default '[]'::jsonb;

update public.tasks
set inverted_logic_history = '[]'::jsonb
where inverted_logic_history is null;

alter table public.tasks
  drop constraint if exists tasks_inverted_logic_history_check;
alter table public.tasks
  add constraint tasks_inverted_logic_history_check
  check (jsonb_typeof(inverted_logic_history) = 'array');

-- Exact dates of switches made before this migration were not stored. Preserve
-- their earlier statistics as regular and start the current inversion today.
drop trigger if exists maintain_task_inverted_logic_history on public.tasks;

update public.tasks as task
set inverted_logic_history = jsonb_build_array(
  jsonb_build_object(
    'effective_on', timezone(
      coalesce(nullif(profile.time_zone, ''), 'Europe/Moscow'),
      now()
    )::date,
    'inverted_logic', true
  )
)
from public.profiles as profile
where profile.id = task.user_id
  and task.inverted_logic = true
  and jsonb_array_length(task.inverted_logic_history) = 0;

create or replace function public.maintain_task_inverted_logic_history()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_time_zone text;
  effective_date date;
  retained_history jsonb;
begin
  select coalesce(nullif(profile.time_zone, ''), 'Europe/Moscow')
  into selected_time_zone
  from public.profiles as profile
  where profile.id = new.user_id;

  selected_time_zone := coalesce(selected_time_zone, 'Europe/Moscow');

  if tg_op = 'INSERT' then
    new.inverted_logic_history := '[]'::jsonb;

    if new.inverted_logic then
      begin
        effective_date := timezone(selected_time_zone, coalesce(new.created_at, now()))::date;
      exception
        when invalid_parameter_value then
          effective_date := timezone('Europe/Moscow', coalesce(new.created_at, now()))::date;
      end;

      new.inverted_logic_history := jsonb_build_array(
        jsonb_build_object(
          'effective_on', effective_date,
          'inverted_logic', true
        )
      );
    end if;

    return new;
  end if;

  new.inverted_logic_history := coalesce(old.inverted_logic_history, '[]'::jsonb);
  if new.inverted_logic is not distinct from old.inverted_logic then
    return new;
  end if;

  begin
    effective_date := timezone(selected_time_zone, now())::date;
  exception
    when invalid_parameter_value then
      effective_date := timezone('Europe/Moscow', now())::date;
  end;

  select coalesce(
    jsonb_agg(history_entry.value order by history_entry.position),
    '[]'::jsonb
  )
  into retained_history
  from jsonb_array_elements(new.inverted_logic_history)
    with ordinality as history_entry(value, position)
  where history_entry.value ->> 'effective_on' <> effective_date::text;

  new.inverted_logic_history := retained_history || jsonb_build_array(
    jsonb_build_object(
      'effective_on', effective_date,
      'inverted_logic', new.inverted_logic
    )
  );

  return new;
end;
$$;

drop trigger if exists maintain_task_inverted_logic_history on public.tasks;
create trigger maintain_task_inverted_logic_history
before insert or update on public.tasks
for each row
execute function public.maintain_task_inverted_logic_history();

create or replace function public.prevent_marked_inverted_task_logic_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_time_zone text;
  user_today date;
begin
  if new.inverted_logic is distinct from old.inverted_logic then
    select coalesce(nullif(profile.time_zone, ''), 'Europe/Moscow')
    into selected_time_zone
    from public.profiles as profile
    where profile.id = old.user_id;

    begin
      user_today := timezone(coalesce(selected_time_zone, 'Europe/Moscow'), now())::date;
    exception
      when invalid_parameter_value then
        user_today := timezone('Europe/Moscow', now())::date;
    end;

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
