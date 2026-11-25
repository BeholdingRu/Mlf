-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
-- Разделители хранятся в tasks под пятью зарезервированными именами.
-- Создание/удаление записи и изменение порядка выполняются одной транзакцией RPC.

alter table public.profiles
  add column if not exists daily_task_order uuid[] default null;

alter table public.tasks
  add column if not exists separator_style text;

create unique index if not exists tasks_user_separator_title_unique
  on public.tasks (user_id, title)
  where title ~ '^__mlf_task_separator_[1-5]__$';

alter table public.tasks
  drop constraint if exists tasks_separator_shape_check;
alter table public.tasks
  add constraint tasks_separator_shape_check
  check (
    lower(btrim(title)) !~ '^__mlf_task_separator_'
    or (
      title ~ '^__mlf_task_separator_[1-5]__$'
      and task_kind is null
      and bible_daily_chapter_target is null
      and habit_days = 1
      and inverted_logic = false
      and inverted_logic_history = '[]'::jsonb
      and countdown_enabled = false
      and withdrawal_started_on is null
      and withdrawal_restart_on is null
    )
  );

alter table public.tasks
  drop constraint if exists tasks_separator_style_check;
alter table public.tasks
  add constraint tasks_separator_style_check
  check (
    separator_style is null
    or (
      title ~ '^__mlf_task_separator_[1-5]__$'
      and separator_style in (
        'line', 'wave', 'snake', 'zigzag', 'dots',
        'dashes', 'double', 'diamonds', 'braid', 'fade'
      )
    )
  );

create or replace function public.prevent_task_separator_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.title ~ '^__mlf_task_separator_[1-5]__$' then
    if (to_jsonb(new) - 'separator_style') is distinct from (to_jsonb(old) - 'separator_style') then
      raise exception 'Разделитель нельзя редактировать как обычную задачу';
    end if;
  elsif lower(btrim(new.title)) ~ '^__mlf_task_separator_'
    and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'Разделитель нельзя редактировать как обычную задачу';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_task_separator_update on public.tasks;
create trigger prevent_task_separator_update
before update on public.tasks
for each row
execute function public.prevent_task_separator_update();

create or replace function public.prevent_task_separator_completion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks as task
    where task.id = new.task_id
      and task.title ~ '^__mlf_task_separator_[1-5]__$'
  ) then
    raise exception 'Разделители не имеют отметок выполнения';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_task_separator_completion on public.task_completions;
create trigger prevent_task_separator_completion
before insert or update on public.task_completions
for each row
execute function public.prevent_task_separator_completion();

create or replace function public.create_task_separator(
  anchor_task_id uuid,
  ordered_task_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  anchor_task public.tasks%rowtype;
  created_separator public.tasks%rowtype;
  separator_number integer;
  next_sort_order integer;
  current_order uuid[];
  missing_task_ids uuid[];
  next_order uuid[];
  anchor_position integer;
begin
  if current_user_id is null then
    raise exception 'Пользователь не авторизован';
  end if;

  -- Serialize separator mutations for one user, including slot allocation.
  perform 1
  from public.profiles as profile
  where profile.id = current_user_id
  for update;
  if not found then
    raise exception 'Профиль не найден';
  end if;

  select task.*
  into anchor_task
  from public.tasks as task
  where task.id = anchor_task_id
    and task.user_id = current_user_id
    and task.title !~ '^__mlf_task_separator_[1-5]__$'
  for share;
  if not found then
    raise exception 'Добавьте хотя бы одну задачу для создания разделителя';
  end if;

  select available.number
  into separator_number
  from generate_series(1, 5) as available(number)
  where not exists (
    select 1
    from public.tasks as task
    where task.user_id = current_user_id
      and task.title = '__mlf_task_separator_' || available.number::text || '__'
  )
  order by available.number
  limit 1;
  if separator_number is null then
    raise exception 'Можно добавить не больше пяти разделителей';
  end if;

  if exists (
    select 1
    from unnest(coalesce(ordered_task_ids, '{}'::uuid[])) as requested(task_id)
    where requested.task_id is null
      or not exists (
        select 1
        from public.tasks as task
        where task.id = requested.task_id
          and task.user_id = current_user_id
      )
  ) then
    raise exception 'Список задач изменился. Обновите страницу и попробуйте ещё раз';
  end if;

  select coalesce(array_agg(requested.task_id order by requested.first_position), '{}'::uuid[])
  into current_order
  from (
    select item.task_id, min(item.position) as first_position
    from unnest(coalesce(ordered_task_ids, '{}'::uuid[]))
      with ordinality as item(task_id, position)
    group by item.task_id
  ) as requested;

  -- Keep rows created by another tab after this client's list was loaded.
  select coalesce(
    array_agg(task.id order by task.withdrawal_syndrome, task.sort_order, task.created_at, task.id),
    '{}'::uuid[]
  )
  into missing_task_ids
  from public.tasks as task
  where task.user_id = current_user_id
    and not (task.id = any(current_order));

  current_order := current_order || missing_task_ids;
  anchor_position := array_position(current_order, anchor_task_id);

  select coalesce(max(task.sort_order), -1) + 1
  into next_sort_order
  from public.tasks as task
  where task.user_id = current_user_id;

  insert into public.tasks (
    user_id,
    title,
    task_kind,
    habit_days,
    sort_order,
    withdrawal_syndrome,
    inverted_logic,
    countdown_enabled
  )
  values (
    current_user_id,
    '__mlf_task_separator_' || separator_number::text || '__',
    null,
    1,
    next_sort_order,
    anchor_task.withdrawal_syndrome,
    false,
    false
  )
  returning * into created_separator;

  next_order := current_order[1:anchor_position]
    || array[created_separator.id]
    || coalesce(current_order[anchor_position + 1:cardinality(current_order)], '{}'::uuid[]);

  update public.profiles as profile
  set daily_task_order = next_order
  where profile.id = current_user_id;

  return jsonb_build_object(
    'task', to_jsonb(created_separator),
    'daily_task_order', to_jsonb(next_order)
  );
end;
$$;

create or replace function public.delete_task_separator(separator_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  next_order uuid[];
begin
  if current_user_id is null then
    raise exception 'Пользователь не авторизован';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = current_user_id
  for update;
  if not found then
    raise exception 'Профиль не найден';
  end if;

  perform 1
  from public.tasks as task
  where task.id = separator_task_id
    and task.user_id = current_user_id
    and task.title ~ '^__mlf_task_separator_[1-5]__$'
  for update;
  if not found then
    raise exception 'Разделитель не найден';
  end if;

  delete from public.tasks as task
  where task.id = separator_task_id
    and task.user_id = current_user_id;

  update public.profiles as profile
  set daily_task_order = array_remove(profile.daily_task_order, separator_task_id)
  where profile.id = current_user_id
  returning profile.daily_task_order into next_order;

  return jsonb_build_object('daily_task_order', to_jsonb(next_order));
end;
$$;

revoke all on function public.create_task_separator(uuid, uuid[]) from public;
revoke all on function public.delete_task_separator(uuid) from public;
grant execute on function public.create_task_separator(uuid, uuid[]) to authenticated;
grant execute on function public.delete_task_separator(uuid) to authenticated;

create or replace function public.set_task_separator_style(
  separator_task_id uuid,
  visual_style text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_separator public.tasks%rowtype;
begin
  if current_user_id is null then
    raise exception 'Пользователь не авторизован';
  end if;

  if visual_style is null or visual_style not in (
    'line', 'wave', 'snake', 'zigzag', 'dots',
    'dashes', 'double', 'diamonds', 'braid', 'fade'
  ) then
    raise exception 'Выберите доступный вид разделителя';
  end if;

  update public.tasks as task
  set separator_style = visual_style
  where task.id = separator_task_id
    and task.user_id = current_user_id
    and task.title ~ '^__mlf_task_separator_[1-5]__$'
  returning task.* into updated_separator;

  if not found then
    raise exception 'Разделитель не найден';
  end if;

  return to_jsonb(updated_separator);
end;
$$;

revoke all on function public.set_task_separator_style(uuid, text) from public;
grant execute on function public.set_task_separator_style(uuid, text) to authenticated;
