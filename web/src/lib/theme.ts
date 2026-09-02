export const themes = [
  { id: 'green', name: 'Зелёная', colors: ['#f3efe4', '#3f6b45', '#6ea36a'] },
  { id: 'dark', name: 'Тёмная', colors: ['#151a1e', '#5eead4', '#94a3b8'] },
  { id: 'dark-blue', name: 'Тёмно-синяя', colors: ['#0f172a', '#3b82f6', '#60a5fa'] },
  { id: 'dark-purple', name: 'Тёмно-фиолетовая', colors: ['#1e1b2e', '#a78bfa', '#c4b5fd'] },
] as const

export type ThemeId = (typeof themes)[number]['id']

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

export function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return 'green'

  const savedTheme = window.localStorage.getItem(storageKey)
  return normalizeTheme(savedTheme)
}

export function applyTheme(theme: ThemeId) {
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
