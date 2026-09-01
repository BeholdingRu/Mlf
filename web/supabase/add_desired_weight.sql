-- Добавляем поле desired_weight (желаемый вес) в таблицу profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS desired_weight numeric(6, 1);
