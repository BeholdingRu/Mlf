-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
create table if not exists public.path_day_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cycle_started_on date not null,
  day text not null check (day in ('saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  created_at timestamptz not null default now(),
  unique (user_id, cycle_started_on, day)
);

create index if not exists path_day_confirmations_user_cycle_idx
  on public.path_day_confirmations (user_id, cycle_started_on);

alter table public.path_day_confirmations enable row level security;

drop policy if exists "path_day_confirmations_all_own" on public.path_day_confirmations;
create policy "path_day_confirmations_all_own" on public.path_day_confirmations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
