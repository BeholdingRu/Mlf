import { useState, type FormEvent } from 'react'
import { useData } from '../hooks/useData'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/auth-errors'
import {
  applyFontScale,
  applyTheme,
  fontScales,
  getSavedFontScale,
  getSavedTheme,
  normalizeFontScale,
  normalizeShabbatTheme,
  normalizeTheme,
  shabbatThemes,
  themes,
  type FontScale,
  type ShabbatThemeId,
  type ThemeId,
} from '../lib/theme'
import { SUNSET_CITIES, TIME_ZONES, type SunsetCity } from '../lib/sunset'
import { isShabbatActive } from '../lib/shabbat'

type SettingsModalProps = {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    profile,
    saveWeightVisibility: persistWeightVisibility,
    saveFontScale,
    saveLocation,
    saveShabbatEnabled,
    saveShabbatTheme,
    saveTheme,
  } = useData()
  const { user, signOut, changePassword } = useAuth()
  const [enabled, setEnabled] = useState(profile?.weight_enabled ?? false)
  const [error, setError] = useState<string | null>(null)
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [nutritionInfoOpen, setNutritionInfoOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeId>(() =>
    profile ? normalizeTheme(profile.theme) : getSavedTheme(),
  )
  const [fontScale, setFontScale] = useState<FontScale>(() =>
    profile ? normalizeFontScale(profile.font_scale) : getSavedFontScale(),
  )
  const [timeZone, setTimeZone] = useState(profile?.time_zone ?? 'Europe/Moscow')
  const [cityName, setCityName] = useState(profile?.city_name ?? '')
  const [shabbatEnabled, setShabbatEnabled] = useState(profile?.shabbat_enabled ?? false)
  const [shabbatTheme, setShabbatTheme] = useState<ShabbatThemeId>(() => normalizeShabbatTheme(profile?.shabbat_theme))
  const shabbatActive = isShabbatActive(profile)

  async function changeWeightVisibility(nextEnabled: boolean) {
    const previousEnabled = enabled
    setEnabled(nextEnabled)
    setBusy(true)
    setError(null)
    try {
      await persistWeightVisibility(nextEnabled)
    } catch (err) {
      setEnabled(previousEnabled)
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройку отображения')
    } finally {
      setBusy(false)
    }
  }

  async function selectTheme(nextTheme: ThemeId) {
    if (nextTheme === theme || busy) return
    setTheme(nextTheme)
    applyTheme(nextTheme)
    setBusy(true)
    setError(null)
    try {
      await saveTheme(nextTheme)
    } catch (err) {
      const previousTheme = profile ? normalizeTheme(profile.theme) : getSavedTheme()
      setTheme(previousTheme)
      applyTheme(previousTheme)
      setError(err instanceof Error ? err.message : 'Не удалось сохранить тему')
    } finally {
      setBusy(false)
    }
  }

  async function selectShabbatTheme(nextTheme: ShabbatThemeId) {
    if (nextTheme === shabbatTheme || busy) return
    const previousTheme = shabbatTheme
    setShabbatTheme(nextTheme)
    applyTheme(nextTheme)
    setBusy(true)
    setError(null)
    try {
      await saveShabbatTheme(nextTheme)
    } catch (err) {
      setShabbatTheme(previousTheme)
      applyTheme(previousTheme)
      setError(err instanceof Error ? err.message : 'Не удалось сохранить праздничное оформление')
    } finally {
      setBusy(false)
    }
  }

  async function selectFontScale(nextScale: FontScale) {
    if (nextScale === fontScale || busy) return
    const previousScale = profile ? normalizeFontScale(profile.font_scale) : getSavedFontScale()
    setFontScale(nextScale)
    applyFontScale(nextScale)
    setBusy(true)
    setError(null)
    try {
      await saveFontScale(nextScale)
    } catch (err) {
      setFontScale(previousScale)
      applyFontScale(previousScale)
      setError(err instanceof Error ? err.message : 'Не удалось сохранить масштаб текста')
    } finally {
      setBusy(false)
    }
  }

  async function saveSunsetLocation() {
    const city = SUNSET_CITIES.find((option) => option.name === cityName) ?? null
    setBusy(true)
    setError(null)
    try {
      await saveLocation(timeZone, city)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить город и часовой пояс')
    } finally {
      setBusy(false)
    }
  }

  async function changeShabbatEnabled(nextEnabled: boolean) {
    const previousEnabled = shabbatEnabled
    setShabbatEnabled(nextEnabled)
    setBusy(true)
    setError(null)
    try {
      await saveShabbatEnabled(nextEnabled)
    } catch (err) {
      setShabbatEnabled(previousEnabled)
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройку Шаббата')
    } finally {
      setBusy(false)
    }
  }

  async function onPasswordChange(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPasswordInfo(null)

    if (newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов')
      return
    }
    if (newPassword !== newPasswordConfirmation) {
      setError('Новые пароли не совпадают')
      return
    }
    if (currentPassword === newPassword) {
      setError('Новый пароль должен отличаться от текущего')
      return
    }

    setPasswordBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirmation('')
      setPasswordInfo('Пароль успешно изменён.')
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Не удалось изменить пароль'))
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="settings-title">Настройки</h2>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <section className="settings-block">
          <button
            type="button"
            className="primary compact settings-action"
            aria-expanded={appearanceOpen}
            aria-controls="appearance-settings"
            onClick={() => setAppearanceOpen((open) => !open)}
          >
            Оформление
          </button>
          {appearanceOpen && (
            <div id="appearance-settings" className="appearance-settings">
              <p className="hint">
                {shabbatActive
                  ? 'Во время Шаббата доступно праздничное христианское оформление.'
                  : 'Тема сохраняется в профиле и будет доступна на всех устройствах.'}
              </p>
              <div className="theme-options" role="radiogroup" aria-label="Выбор темы">
                {shabbatActive ? shabbatThemes.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`theme-option${shabbatTheme === option.id ? ' active' : ''}`}
                    role="radio"
                    aria-checked={shabbatTheme === option.id}
                    disabled={busy}
                    onClick={() => selectShabbatTheme(option.id)}
                  >
                    <span className="theme-swatches" aria-hidden="true">
                      {option.colors.map((color) => (
                        <span key={color} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span>{option.name}</span>
                  </button>
                )) : themes.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`theme-option${theme === option.id ? ' active' : ''}`}
                    role="radio"
                    aria-checked={theme === option.id}
                    disabled={busy}
                    onClick={() => selectTheme(option.id)}
                  >
                    <span className="theme-swatches" aria-hidden="true">
                      {option.colors.map((color) => (
                        <span key={color} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span>{option.name}</span>
                  </button>
                ))}
              </div>

              <div className="font-scale-setting">
                <h4>Масштаб текста</h4>
                <p className="hint">Увеличивает или уменьшает размер текста и элементов интерфейса.</p>
                <div className="font-scale-options" role="radiogroup" aria-label="Масштаб текста">
                  {fontScales.map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      className={`font-scale-option${fontScale === scale ? ' active' : ''}`}
                      role="radio"
                      aria-checked={fontScale === scale}
                      disabled={busy}
                      onClick={() => selectFontScale(scale)}
                    >
                      {Math.round(scale * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="settings-block">
          <h3>Календарь</h3>
          <p className="hint">Укажите город и часовой пояс для расчёта времени захода солнца.</p>
          <label htmlFor="settings-time-zone">
            Часовой пояс
            <select
              id="settings-time-zone"
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
              disabled={busy}
            >
              {TIME_ZONES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label htmlFor="settings-city">
            Город
            <select
              id="settings-city"
              value={cityName}
              onChange={(event) => setCityName(event.target.value)}
              disabled={busy}
            >
              <option value="">Не показывать время заката</option>
              {SUNSET_CITIES.map((city: SunsetCity) => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="primary compact settings-action" onClick={saveSunsetLocation} disabled={busy}>
            Сохранить календарь
          </button>
          <div className="settings-choice-block">
            <label className="toggle">
              <input
                type="checkbox"
                checked={shabbatEnabled}
                onChange={(event) => changeShabbatEnabled(event.target.checked)}
                disabled={busy}
              />
              Шаббат
            </label>
            <p className="hint">С пятничного до субботнего захода солнца включается праздничное оформление, а в календаре отображается время пятничного захода солнца.</p>
            {shabbatEnabled && !cityName && <p className="hint">Для включения оформления выберите город и сохраните календарь.</p>}
          </div>
        </section>

        <section className="settings-block">
          <div className="settings-choice-block">
            <div className="weight-visibility-setting">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => changeWeightVisibility(event.target.checked)}
                  disabled={busy}
                />
                Показывать данные о весе в кабинете и статистике
              </label>
              <button
                type="button"
                className="info-button"
                aria-label="Дополнительные сведения об автоматической задаче питания"
                aria-expanded={nutritionInfoOpen}
                aria-controls="nutrition-task-info"
                onClick={() => setNutritionInfoOpen((open) => !open)}
              >
                i
              </button>
              {nutritionInfoOpen && (
                <div id="nutrition-task-info" className="nutrition-task-info" role="status">
                  Если вы включили отображение данных о весе, то можете создать новую задачу, которая
                  называется «Телостроительство:Питание», строго так, без кавычек. Эта задача будет
                  помечаться каждый новый день как выполненная автоматически, если вы не превысили
                  дневную норму калорий.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="settings-block">
          <h3>Профиль</h3>
          <p className="email">{user?.email}</p>
          <button
            type="button"
            className="primary compact settings-action"
            aria-expanded={passwordFormOpen}
            aria-controls="password-change-form"
            onClick={() => setPasswordFormOpen((open) => !open)}
          >
            Смена пароля
          </button>
          {passwordFormOpen && (
            <form id="password-change-form" onSubmit={onPasswordChange}>
              <label>
                Текущий пароль
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                Новый пароль
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                Повторите новый пароль
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPasswordConfirmation}
                  onChange={(event) => setNewPasswordConfirmation(event.target.value)}
                />
              </label>
              <button className="primary compact" type="submit" disabled={passwordBusy}>
                {passwordBusy ? 'Сохранение…' : 'Изменить пароль'}
              </button>
            </form>
          )}
          {passwordInfo && <p className="banner info">{passwordInfo}</p>}
          <button type="button" className="danger compact settings-action" onClick={() => signOut()}>
            Выйти из аккаунта
          </button>
        </section>

        {error && <p className="banner error">{error}</p>}
      </div>
    </div>
  )
}
