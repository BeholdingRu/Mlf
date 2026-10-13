-- Run once in the Supabase SQL editor to enable the immutable countdown mode
-- for regular daily tasks. The task's created_at timestamp is its start.
alter table public.tasks
  add column if not exists countdown_enabled boolean not null default false;

-- Clear impossible legacy combinations before enforcing the new invariant.
update public.tasks
set countdown_enabled = false
where countdown_enabled
  and (
    withdrawal_syndrome
    or inverted_logic
    or task_kind is not null
    or lower(regexp_replace(btrim(title), '\s*:\s*', ':', 'g')) = 'телостроительство:питание'
    or regexp_replace(lower(btrim(title)), '\s+', ' ', 'g')
      ~ '^(чтение библии|чтение бибили)($|[[:space:]]|:|—|-)'
  );

alter table public.tasks
  drop constraint if exists tasks_countdown_regular_check;
alter table public.tasks
  add constraint tasks_countdown_regular_check
  check (
    not countdown_enabled
    or (
      withdrawal_syndrome = false
      and inverted_logic = false
      and task_kind is null
      and lower(regexp_replace(btrim(title), '\s*:\s*', ':', 'g')) <> 'телостроительство:питание'
      and regexp_replace(lower(btrim(title)), '\s+', ' ', 'g')
        !~ '^(чтение библии|чтение бибили)($|[[:space:]]|:|—|-)'
    )
  );

create or replace function public.prevent_task_countdown_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.countdown_enabled is distinct from old.countdown_enabled then
    raise exception 'Режим обратного отсчёта можно выбрать только при создании задачи';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_task_countdown_change on public.tasks;
create trigger prevent_task_countdown_change
before update on public.tasks
for each row
execute function public.prevent_task_countdown_change();
