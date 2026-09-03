-- Выполните этот файл в Supabase SQL Editor после add_saved_product_categories.sql.
alter table public.saved_products
  add column if not exists is_favorite boolean not null default false;
