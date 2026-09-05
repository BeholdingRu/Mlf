-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
create table if not exists public.course_lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id text not null,
  lesson_number integer not null check (lesson_number > 0),
  created_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_number)
);

create index if not exists course_lesson_completions_user_course_idx
  on public.course_lesson_completions (user_id, course_id);

alter table public.course_lesson_completions enable row level security;

drop policy if exists "course_lesson_completions_all_own" on public.course_lesson_completions;
create policy "course_lesson_completions_all_own" on public.course_lesson_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
