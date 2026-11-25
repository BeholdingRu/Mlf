-- Выполните после add_task_separators.sql в Supabase SQL Editor.
-- NULL сохраняет классическую линию у существующих разделителей.
alter table public.tasks
  add column if not exists separator_style text;

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
