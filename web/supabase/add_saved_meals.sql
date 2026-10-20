-- Run (or rerun after an application update) in the Supabase SQL editor.
-- Each JSON item keeps the saved product id and its weight; nutrition stays live in saved_products.
create table if not exists public.saved_meal_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 60
    and lower(name) not in ('группы', 'без фильтра')
  ),
  sort_order smallint not null check (sort_order between 0 and 5),
  created_at timestamptz not null default now()
);

create unique index if not exists saved_meal_filters_user_name_unique_idx
  on public.saved_meal_filters (user_id, lower(name));
create unique index if not exists saved_meal_filters_user_order_unique_idx
  on public.saved_meal_filters (user_id, sort_order);

alter table public.saved_meal_filters enable row level security;
revoke all on table public.saved_meal_filters from anon;
grant select, insert, update, delete on table public.saved_meal_filters to authenticated;

drop policy if exists "saved_meal_filters_all_own" on public.saved_meal_filters;
create policy "saved_meal_filters_all_own" on public.saved_meal_filters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  items jsonb not null check (
    case
      when jsonb_typeof(items) = 'array'
        then jsonb_array_length(items) between 1 and 100
      else false
    end
  ),
  filter_id uuid references public.saved_meal_filters (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.saved_meals
  add column if not exists filter_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_meals_filter_id_fkey'
      and conrelid = 'public.saved_meals'::regclass
  ) then
    alter table public.saved_meals
      add constraint saved_meals_filter_id_fkey
      foreign key (filter_id)
      references public.saved_meal_filters (id)
      on delete set null;
  end if;
end;
$$;

create or replace function public.validate_saved_meal_filter_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.filter_id is not null and not exists (
    select 1
    from public.saved_meal_filters as filter
    where filter.id = new.filter_id
      and filter.user_id = new.user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Meal filter must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_saved_meal_filter_owner_before_write on public.saved_meals;
create trigger validate_saved_meal_filter_owner_before_write
  before insert or update of user_id, filter_id
  on public.saved_meals
  for each row execute function public.validate_saved_meal_filter_owner();

revoke all on function public.validate_saved_meal_filter_owner() from public, anon;

create unique index if not exists saved_meals_user_name_unique_idx
  on public.saved_meals (user_id, lower(trim(name)));

create index if not exists saved_meals_user_created_idx
  on public.saved_meals (user_id, created_at);
create index if not exists saved_meals_filter_user_idx
  on public.saved_meals (filter_id, user_id);

alter table public.saved_meals enable row level security;

revoke all on table public.saved_meals from anon;
grant select, insert, update, delete on table public.saved_meals to authenticated;

drop policy if exists "saved_meals_all_own" on public.saved_meals;
create policy "saved_meals_all_own" on public.saved_meals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.saved_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  planned_on date not null,
  saved_meal_ids jsonb not null check (
    jsonb_typeof(saved_meal_ids) = 'array'
    and jsonb_array_length(saved_meal_ids) between 1 and 100
  ),
  detached_group_signature text,
  created_at timestamptz not null default now()
);

alter table public.saved_meal_plans
  add column if not exists detached_group_signature text;

create index if not exists saved_meal_plans_user_date_idx
  on public.saved_meal_plans (user_id, planned_on, created_at);

alter table public.saved_meal_plans enable row level security;
revoke all on table public.saved_meal_plans from anon;
grant select, insert, update, delete on table public.saved_meal_plans to authenticated;

drop policy if exists "saved_meal_plans_all_own" on public.saved_meal_plans;
create policy "saved_meal_plans_all_own" on public.saved_meal_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Replaces and removes planner rows in one transaction. This prevents a
-- temporary network failure from leaving duplicated or partially regrouped plans.
drop function if exists public.sync_saved_meal_plans(jsonb, uuid[]);
create function public.sync_saved_meal_plans(
  replacement_rows jsonb default '[]'::jsonb,
  removed_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(replacement_rows) <> 'array' then
    raise exception 'replacement_rows must be a JSON array';
  end if;

  insert into public.saved_meal_plans (
    id,
    user_id,
    planned_on,
    saved_meal_ids,
    detached_group_signature,
    created_at
  )
  select
    replacement.id,
    current_user_id,
    replacement.planned_on,
    replacement.saved_meal_ids,
    replacement.detached_group_signature,
    coalesce(replacement.created_at, now())
  from jsonb_to_recordset(replacement_rows) as replacement (
    id uuid,
    planned_on date,
    saved_meal_ids jsonb,
    detached_group_signature text,
    created_at timestamptz
  )
  on conflict (id) do update
  set
    planned_on = excluded.planned_on,
    saved_meal_ids = excluded.saved_meal_ids,
    detached_group_signature = excluded.detached_group_signature
  where public.saved_meal_plans.user_id = current_user_id;

  delete from public.saved_meal_plans as plan
  where plan.user_id = current_user_id
    and plan.id = any(coalesce(removed_ids, '{}'::uuid[]))
    and not exists (
      select 1
      from jsonb_array_elements(replacement_rows) as replacement
      where (replacement ->> 'id')::uuid = plan.id
    );

  return (
    select coalesce(jsonb_agg(to_jsonb(plan) order by plan.created_at), '[]'::jsonb)
    from public.saved_meal_plans as plan
    where plan.user_id = current_user_id
      and exists (
        select 1
        from jsonb_array_elements(replacement_rows) as replacement
        where (replacement ->> 'id')::uuid = plan.id
      )
  );
end;
$$;

revoke all on function public.sync_saved_meal_plans(jsonb, uuid[]) from public, anon;
grant execute on function public.sync_saved_meal_plans(jsonb, uuid[]) to authenticated;
