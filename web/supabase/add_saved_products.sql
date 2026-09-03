-- Личный каталог продуктов пользователя.
create table if not exists public.saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  calories_per_100g numeric(6, 2) not null check (calories_per_100g > 0),
  proteins_per_100g numeric(6, 2) not null default 0 check (proteins_per_100g >= 0),
  fats_per_100g numeric(6, 2) not null default 0 check (fats_per_100g >= 0),
  carbohydrates_per_100g numeric(6, 2) not null default 0 check (carbohydrates_per_100g >= 0),
  is_favorite boolean not null default false,
  category text not null default 'Мясо и мясные продукты' check (category in (
    'Мясо и мясные продукты', 'Рыба и морепродукты', 'Молочные продукты и яйца',
    'Овощи, зелень, грибы', 'Фрукты и ягоды', 'Крупы, макаронные изделия и мука',
    'Хлебобулочные изделия', 'Бобовые и орехи', 'Масла, жиры и соусы',
    'Готовые блюда и фастфуд', 'Напитки'
  )),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists saved_products_user_name_idx on public.saved_products (user_id, name);

alter table public.saved_products enable row level security;

drop policy if exists "saved_products_all_own" on public.saved_products;
create policy "saved_products_all_own" on public.saved_products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
