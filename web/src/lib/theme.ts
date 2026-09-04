export const themes = [
  { id: 'green', name: 'Зелёная', colors: ['#f3efe4', '#3f6b45', '#6ea36a'] },
  { id: 'dark', name: 'Тёмная', colors: ['#151a1e', '#5eead4', '#94a3b8'] },
  { id: 'dark-blue', name: 'Тёмно-синяя', colors: ['#0f172a', '#3b82f6', '#60a5fa'] },
  { id: 'dark-purple', name: 'Тёмно-фиолетовая', colors: ['#1e1b2e', '#a78bfa', '#c4b5fd'] },
] as const

export type ThemeId = (typeof themes)[number]['id']
export const shabbatThemes = [
  { id: 'shabbat-soft', name: 'Светлая', colors: ['#fffdf7', '#d5aa49', '#f5eacd'] },
  { id: 'shabbat-gold', name: 'Золотая', colors: ['#f8f0d8', '#b57d1e', '#e9d09a'] },
  { id: 'shabbat-dawn', name: 'Рассвет', colors: ['#223c58', '#dca83e', '#f6dc9d'] },
  { id: 'shabbat-parchment', name: 'Пергамент', colors: ['#fbf4e4', '#b58b42', '#77804a'] },
  { id: 'shabbat-parchment-olive', name: 'Оливковый пергамент', colors: ['#f3ead3', '#8c7943', '#697644'] },
  { id: 'shabbat-parchment-evening', name: 'Тихий пергамент', colors: ['#efe0bf', '#9d7138', '#817847'] },
] as const

export type ShabbatThemeId = (typeof shabbatThemes)[number]['id']
export type AppliedThemeId = ThemeId | ShabbatThemeId

const storageKey = 'mlf-theme'
const fontScaleStorageKey = 'mlf-font-scale'

export const fontScales = [0.9, 1, 1.1, 1.2] as const
export type FontScale = (typeof fontScales)[number]

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value)
}

export function normalizeTheme(value: string | null | undefined): ThemeId {
  return isThemeId(value) ? value : 'green'
}

export function normalizeShabbatTheme(value: string | null | undefined): ShabbatThemeId {
  return shabbatThemes.some((theme) => theme.id === value) ? value as ShabbatThemeId : 'shabbat-dawn'
}

export function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return 'green'

  const savedTheme = window.localStorage.getItem(storageKey)
  return normalizeTheme(savedTheme)
}

export function applyTheme(theme: AppliedThemeId) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(storageKey, theme)
}

export function applySavedTheme() {
  applyTheme(getSavedTheme())
}

export function normalizeFontScale(value: number | string | null | undefined): FontScale {
  const numericValue = Number(value)
  return fontScales.includes(numericValue as FontScale) ? numericValue as FontScale : 1
}

export function getSavedFontScale(): FontScale {
  if (typeof window === 'undefined') return 1

  return normalizeFontScale(window.localStorage.getItem(fontScaleStorageKey))
}

export function applyFontScale(scale: FontScale) {
  document.documentElement.style.setProperty('--font-scale', String(scale))
  window.localStorage.setItem(fontScaleStorageKey, String(scale))
}

export function applySavedFontScale() {
  applyFontScale(getSavedFontScale())
}
