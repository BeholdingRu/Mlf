-- Выполните этот файл в Supabase SQL Editor для существующей базы MLF.
-- NULL сохраняет стандартный порядок; массив UUID задаёт пользовательский порядок задач.
-- Настройка хранится в профиле и доступна на всех устройствах пользователя.

alter table public.profiles
  add column if not exists daily_task_order uuid[] default null;
