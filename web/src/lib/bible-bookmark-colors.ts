export const DEFAULT_BIBLE_BOOKMARK_COLOR = '#fff2a8'

export const BIBLE_BOOKMARK_COLORS = [
  { value: DEFAULT_BIBLE_BOOKMARK_COLOR, label: 'Жёлтый' },
  { value: '#ffc857', label: 'Золотой' },
  { value: '#ff9f43', label: 'Оранжевый' },
  { value: '#ff7f6e', label: 'Коралловый' },
  { value: '#ef5350', label: 'Красный' },
  { value: '#d94f70', label: 'Малиновый' },
  { value: '#f48fb1', label: 'Розовый' },
  { value: '#d76dd7', label: 'Фуксия' },
  { value: '#a66de0', label: 'Фиолетовый' },
  { value: '#7e6bd6', label: 'Пурпурный' },
  { value: '#5c6bc0', label: 'Индиго' },
  { value: '#42a5f5', label: 'Синий' },
  { value: '#4fc3f7', label: 'Голубой' },
  { value: '#26c6da', label: 'Бирюзовый' },
  { value: '#26a69a', label: 'Тёмно-бирюзовый' },
  { value: '#3dbb78', label: 'Изумрудный' },
  { value: '#66bb6a', label: 'Зелёный' },
  { value: '#a8c83f', label: 'Лаймовый' },
  { value: '#78909c', label: 'Серо-синий' },
  { value: '#a8755a', label: 'Коричневый' },
] as const

function hexToRgb(color: string) {
  const normalized = color.trim().toLowerCase()
  const match = /^#([0-9a-f]{6})$/.exec(normalized)
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
  }
}

export function normalizeBibleBookmarkColor(color: string) {
  const normalized = color.trim().toLowerCase()
  const exactColor = BIBLE_BOOKMARK_COLORS.find((option) => option.value === normalized)
  if (exactColor) return exactColor.value

  const source = hexToRgb(normalized)
  if (!source) return DEFAULT_BIBLE_BOOKMARK_COLOR

  let closestColor: string = DEFAULT_BIBLE_BOOKMARK_COLOR
  let closestDistance = Number.POSITIVE_INFINITY
  for (const option of BIBLE_BOOKMARK_COLORS) {
    const candidate = hexToRgb(option.value)
    if (!candidate) continue
    const distance = (source.red - candidate.red) ** 2
      + (source.green - candidate.green) ** 2
      + (source.blue - candidate.blue) ** 2
    if (distance < closestDistance) {
      closestColor = option.value
      closestDistance = distance
    }
  }
  return closestColor
}
