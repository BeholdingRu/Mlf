export const themes = [
  { id: 'green', name: 'Зелёная', colors: ['#f3efe4', '#3f6b45', '#6ea36a'] },
  { id: 'dark', name: 'Тёмная', colors: ['#151a1e', '#5eead4', '#94a3b8'] },
  { id: 'blue', name: 'Синяя', colors: ['#f5f8ff', '#2563eb', '#60a5fa'] },
  { id: 'purple', name: 'Фиолетовая', colors: ['#faf7ff', '#7c3aed', '#c084fc'] },
  { id: 'rose', name: 'Розовая', colors: ['#fff7f8', '#db2777', '#fb7185'] },
  { id: 'amber', name: 'Янтарная', colors: ['#fffbeb', '#d97706', '#fbbf24'] },
  { id: 'ocean', name: 'Океан', colors: ['#f0fdfa', '#0f766e', '#2dd4bf'] },
] as const

export type ThemeId = (typeof themes)[number]['id']

const storageKey = 'mlf-theme'

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
