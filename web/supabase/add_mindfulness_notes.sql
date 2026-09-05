-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
create table if not exists public.mindfulness_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  content text not null check (char_length(trim(content)) between 1 and 7000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mindfulness_notes_user_updated_idx
  on public.mindfulness_notes (user_id, updated_at desc);

alter table public.mindfulness_notes enable row level security;

drop policy if exists "mindfulness_notes_all_own" on public.mindfulness_notes;
create policy "mindfulness_notes_all_own" on public.mindfulness_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
