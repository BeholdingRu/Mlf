export const PRODUCT_CATEGORIES = [
  'Мясо и мясные продукты',
  'Рыба и морепродукты',
  'Молочные продукты и яйца',
  'Овощи, зелень, грибы',
  'Фрукты и ягоды',
  'Крупы, макаронные изделия и мука',
  'Хлебобулочные изделия',
  'Бобовые и орехи',
  'Масла, жиры и соусы',
  'Готовые блюда и фастфуд',
  'Напитки',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = PRODUCT_CATEGORIES[0]
