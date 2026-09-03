-- Выполните этот файл в Supabase SQL Editor для уже существующей базы.
-- Все ранее сохранённые продукты будут отнесены к первой категории.
alter table public.saved_products
  add column if not exists category text;

update public.saved_products
set category = 'Мясо и мясные продукты'
where category is null;

alter table public.saved_products
  alter column category set default 'Мясо и мясные продукты',
  alter column category set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_products_category_check'
      and conrelid = 'public.saved_products'::regclass
  ) then
    alter table public.saved_products
      add constraint saved_products_category_check
      check (category in (
        'Мясо и мясные продукты', 'Рыба и морепродукты', 'Молочные продукты и яйца',
        'Овощи, зелень, грибы', 'Фрукты и ягоды', 'Крупы, макаронные изделия и мука',
        'Хлебобулочные изделия', 'Бобовые и орехи', 'Масла, жиры и соусы',
        'Готовые блюда и фастфуд', 'Напитки'
      ));
  end if;
end $$;
