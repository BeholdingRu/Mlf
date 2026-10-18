export const themes = [
  { id: 'green', name: 'Зелёная', colors: ['#f3efe4', '#3f6b45', '#6ea36a'] },
  { id: 'dark', name: 'Тёмная', colors: ['#151a1e', '#5eead4', '#94a3b8'] },
  { id: 'dark-blue', name: 'Тёмно-бордовая', colors: ['#1b1115', '#d65a78', '#f0a0b4'] },
  { id: 'dark-purple', name: 'Тёмно-янтарная', colors: ['#18140d', '#d3953e', '#f0c36a'] },
  { id: 'dark-nord', name: 'Мокко', colors: ['#1e1e2e', '#cba6f7', '#94e2d5'] },
  { id: 'dark-dracula', name: 'Ночной Токио', colors: ['#1a1b26', '#7aa2f7', '#bb9af7'] },
  { id: 'dark-gruvbox', name: 'Ретро', colors: ['#1d2021', '#fabd2f', '#8ec07c'] },
  { id: 'k-p', name: 'k-p', colors: ['#050611', '#ff2bd6', '#00f6ff'] },
] as const

export type ThemeId = (typeof themes)[number]['id']
export const DEFAULT_THEME: ThemeId = 'dark-gruvbox'
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
const interfaceStyleStorageKey = 'mlf-interface-style'

export const interfaceStyles = ['default', 'style-1', 'style-2'] as const
export type InterfaceStyleId = (typeof interfaceStyles)[number]
export const DEFAULT_INTERFACE_STYLE: InterfaceStyleId = 'style-1'

export const fontScales = [0.9, 1, 1.1, 1.2] as const
export type FontScale = (typeof fontScales)[number]

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value)
}

export function normalizeTheme(value: string | null | undefined): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME
}

export function normalizeShabbatTheme(value: string | null | undefined): ShabbatThemeId {
  return shabbatThemes.some((theme) => theme.id === value) ? value as ShabbatThemeId : 'shabbat-dawn'
}

export function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME

  const savedTheme = window.localStorage.getItem(storageKey)
  return normalizeTheme(savedTheme)
}

export function applyTheme(theme: AppliedThemeId) {
  document.documentElement.dataset.theme = theme
  const themeDefinition = themes.find((option) => option.id === theme)
    ?? shabbatThemes.find((option) => option.id === theme)
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeDefinition?.colors[0] ?? '#1d2021')
  window.localStorage.setItem(storageKey, theme)
}

export function applySavedTheme() {
  applyTheme(getSavedTheme())
}

export function normalizeInterfaceStyle(value: string | null | undefined): InterfaceStyleId {
  return interfaceStyles.includes(value as InterfaceStyleId) ? value as InterfaceStyleId : DEFAULT_INTERFACE_STYLE
}

export function getSavedInterfaceStyle(): InterfaceStyleId {
  if (typeof window === 'undefined') return DEFAULT_INTERFACE_STYLE

  return normalizeInterfaceStyle(window.localStorage.getItem(interfaceStyleStorageKey))
}

export function applyInterfaceStyle(style: InterfaceStyleId) {
  if (style === 'default') {
    delete document.documentElement.dataset.interfaceStyle
  } else {
    document.documentElement.dataset.interfaceStyle = style
  }
  window.localStorage.setItem(interfaceStyleStorageKey, style)
}

export function applySavedInterfaceStyle() {
  applyInterfaceStyle(getSavedInterfaceStyle())
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
