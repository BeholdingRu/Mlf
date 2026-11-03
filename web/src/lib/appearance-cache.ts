import { isShabbatActiveInTimeZone } from './shabbat'
import { getTimeZoneOption } from './sunset'
import {
  applyFontScale,
  applyInterfaceStyle,
  applySavedFontScale,
  applySavedInterfaceStyle,
  applySavedTheme,
  applyTheme,
  DEFAULT_INTERFACE_STYLE,
  DEFAULT_THEME,
  normalizeFontScale,
  normalizeInterfaceStyle,
  normalizeShabbatTheme,
  normalizeTheme,
  type FontScale,
  type InterfaceStyleId,
  type ShabbatThemeId,
  type ThemeId,
} from './theme'

const APPEARANCE_CACHE_VERSION = 1 as const
const APPEARANCE_CACHE_PREFIX = 'mlf:appearance:v1:'

export const SESSION_USER_STORAGE_KEY = 'mlf:session-user-id'

type AppearanceSettingsSource = {
  id: string
  theme: string | null | undefined
  shabbat_theme: string | null | undefined
  interface_style: string | null | undefined
  font_scale: number | string | null | undefined
  time_zone: string | null | undefined
}

export type CachedAppearanceSettings = {
  version: typeof APPEARANCE_CACHE_VERSION
  userId: string
  theme: ThemeId
  shabbatTheme: ShabbatThemeId
  interfaceStyle: InterfaceStyleId
  fontScale: FontScale
  timeZone: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeUserId(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length <= 128 ? normalized : null
}

function cacheKey(userId: string) {
  return `${APPEARANCE_CACHE_PREFIX}${encodeURIComponent(userId)}`
}

function readStorage(storage: Storage, key: string) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function normalizeCachedAppearance(
  value: unknown,
  expectedUserId: string,
): CachedAppearanceSettings | null {
  if (!isRecord(value)
    || value.version !== APPEARANCE_CACHE_VERSION
    || value.userId !== expectedUserId) {
    return null
  }

  return {
    version: APPEARANCE_CACHE_VERSION,
    userId: expectedUserId,
    theme: normalizeTheme(typeof value.theme === 'string' ? value.theme : null),
    shabbatTheme: normalizeShabbatTheme(typeof value.shabbatTheme === 'string' ? value.shabbatTheme : null),
    interfaceStyle: normalizeInterfaceStyle(typeof value.interfaceStyle === 'string' ? value.interfaceStyle : null),
    fontScale: normalizeFontScale(typeof value.fontScale === 'number' || typeof value.fontScale === 'string'
      ? value.fontScale
      : null),
    timeZone: getTimeZoneOption(typeof value.timeZone === 'string' ? value.timeZone : null).id,
  }
}

export function getActiveAppearanceUserId() {
  if (typeof window === 'undefined') return null
  return normalizeUserId(readStorage(window.sessionStorage, SESSION_USER_STORAGE_KEY))
}

export function getCachedAppearanceSettings(userId: string | null | undefined) {
  if (typeof window === 'undefined') return null
  const normalizedUserId = normalizeUserId(userId)
  if (!normalizedUserId) return null

  const serialized = readStorage(window.localStorage, cacheKey(normalizedUserId))
  if (!serialized) return null

  try {
    return normalizeCachedAppearance(JSON.parse(serialized), normalizedUserId)
  } catch {
    return null
  }
}

export function cacheAppearanceSettings(source: AppearanceSettingsSource) {
  if (typeof window === 'undefined') return false
  const userId = normalizeUserId(source.id)
  if (!userId) return false

  const settings: CachedAppearanceSettings = {
    version: APPEARANCE_CACHE_VERSION,
    userId,
    theme: normalizeTheme(source.theme),
    shabbatTheme: normalizeShabbatTheme(source.shabbat_theme),
    interfaceStyle: normalizeInterfaceStyle(source.interface_style),
    fontScale: normalizeFontScale(source.font_scale),
    timeZone: getTimeZoneOption(source.time_zone).id,
  }

  return writeStorage(window.localStorage, cacheKey(userId), JSON.stringify(settings))
}

export function applyCachedAppearance(settings: CachedAppearanceSettings, now = new Date()) {
  const activeTheme = isShabbatActiveInTimeZone(settings.timeZone, now)
    ? settings.shabbatTheme
    : settings.theme
  applyTheme(activeTheme)
  applyInterfaceStyle(settings.interfaceStyle)
  applyFontScale(settings.fontScale)
}

export function applyCachedAppearanceForUser(userId: string | null | undefined, now = new Date()) {
  const settings = getCachedAppearanceSettings(userId)
  if (!settings) return false
  applyCachedAppearance(settings, now)
  return true
}

export function applyDefaultAppearance() {
  applyTheme(DEFAULT_THEME)
  applyInterfaceStyle(DEFAULT_INTERFACE_STYLE)
  applyFontScale(1)
}

export function applyInitialAppearance(now = new Date()) {
  const userId = getActiveAppearanceUserId()
  if (userId && applyCachedAppearanceForUser(userId, now)) return

  // Legacy keys are only a migration fallback for the same authenticated
  // browser session. Signed-out pages must not inherit another user's look.
  if (userId) {
    applySavedTheme()
    applySavedInterfaceStyle()
    applySavedFontScale()
    return
  }

  applyDefaultAppearance()
}

export function applyAppearanceForSessionUser(
  userId: string | null,
  allowLegacyFallback: boolean,
  now = new Date(),
) {
  if (userId && applyCachedAppearanceForUser(userId, now)) return
  if (userId && allowLegacyFallback) {
    applySavedTheme()
    applySavedInterfaceStyle()
    applySavedFontScale()
    return
  }
  applyDefaultAppearance()
}
