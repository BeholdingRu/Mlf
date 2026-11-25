export const TASK_SEPARATOR_STYLES = [
  { id: 'line', name: 'Классическая', description: 'Тонкая линия с мягкими краями' },
  { id: 'wave', name: 'Волна', description: 'Плавные невысокие волны' },
  { id: 'snake', name: 'Змейка', description: 'Выразительные округлые изгибы' },
  { id: 'zigzag', name: 'Зигзаг', description: 'Чёткий геометрический ритм' },
  { id: 'dots', name: 'Точки', description: 'Лёгкая цепочка круглых точек' },
  { id: 'dashes', name: 'Штрихи', description: 'Короткие линии с округлыми концами' },
  { id: 'double', name: 'Двойная', description: 'Две параллельные тонкие линии' },
  { id: 'diamonds', name: 'Ромбы', description: 'Геометрические звенья на линии' },
  { id: 'braid', name: 'Плетение', description: 'Две переплетающиеся волны' },
  { id: 'fade', name: 'Сияние', description: 'Мягкое свечение, тающее по краям' },
] as const

export type TaskSeparatorStyle = (typeof TASK_SEPARATOR_STYLES)[number]['id']

export function isTaskSeparatorStyle(value: unknown): value is TaskSeparatorStyle {
  return typeof value === 'string' && TASK_SEPARATOR_STYLES.some((style) => style.id === value)
}

export function normalizeTaskSeparatorStyle(value?: string | null): TaskSeparatorStyle {
  return isTaskSeparatorStyle(value) ? value : 'line'
}
