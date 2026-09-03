-- Выполните этот файл в Supabase SQL Editor для существующей базы.
-- Для ранее сохранённых продуктов БЖУ будут установлены в 0, после чего их можно отредактировать.
alter table public.saved_products
  add column if not exists proteins_per_100g numeric(6, 2) not null default 0
    check (proteins_per_100g >= 0),
  add column if not exists fats_per_100g numeric(6, 2) not null default 0
    check (fats_per_100g >= 0),
  add column if not exists carbohydrates_per_100g numeric(6, 2) not null default 0
    check (carbohydrates_per_100g >= 0);
