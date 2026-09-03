-- Выполните этот файл в Supabase SQL Editor после add_saved_product_nutrition.sql.
-- Для старых записей БЖУ будут взяты из одноимённого продукта в личном каталоге.
alter table public.daily_food_logs
  add column if not exists proteins_per_100g numeric(6, 2) not null default 0
    check (proteins_per_100g >= 0),
  add column if not exists fats_per_100g numeric(6, 2) not null default 0
    check (fats_per_100g >= 0),
  add column if not exists carbohydrates_per_100g numeric(6, 2) not null default 0
    check (carbohydrates_per_100g >= 0);

update public.daily_food_logs as food_log
set
  proteins_per_100g = product.proteins_per_100g,
  fats_per_100g = product.fats_per_100g,
  carbohydrates_per_100g = product.carbohydrates_per_100g
from public.saved_products as product
where food_log.user_id = product.user_id
  and lower(trim(food_log.product_name)) = lower(trim(product.name))
  and food_log.proteins_per_100g = 0
  and food_log.fats_per_100g = 0
  and food_log.carbohydrates_per_100g = 0;
