import { useState, type FormEvent } from 'react'
import { GUEST_DATA_CLEAR_EVENT } from '../context/GuestDataProvider'
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
    saveAnnualCycleEnabled,
    saveShabbatTheme,
    saveTheme,
    saveNegativeHabitsSecurity,
    isAdmin,
    adminMode,
    setAdminMode,
  } = useData()
  const { user, isGuest, signOut, exitGuestMode, changePassword, verifyPassword } = useAuth()
  const [enabled, setEnabled] = useState(profile?.weight_enabled ?? false)
  const [error, setError] = useState<string | null>(null)
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)
  const [pinFormOpen, setPinFormOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [pinAccountPassword, setPinAccountPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirmation, setNewPinConfirmation] = useState('')
  const [pinInfo, setPinInfo] = useState<string | null>(null)
  const [guestDataInfo, setGuestDataInfo] = useState<string | null>(null)
  const [nutritionInfoOpen, setNutritionInfoOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeId>(() =>
    profile ? normalizeTheme(profile.theme) : getSavedTheme(),
  )
  const [fontScale, setFontScale] = useState<FontScale>(() =>
    profile ? normalizeFontScale(profile.font_scale) : getSavedFontScale(),
  )
  const [timeZone, setTimeZone] = useState(profile?.time_zone ?? 'Europe/Moscow')
  const [cityName, setCityName] = useState(profile?.city_name ?? '')
  const [annualCycleEnabled, setAnnualCycleEnabled] = useState(profile?.annual_cycle_enabled ?? false)
  const [shabbatTheme, setShabbatTheme] = useState<ShabbatThemeId>(() => normalizeShabbatTheme(profile?.shabbat_theme))
  const shabbatActive = isShabbatActive(profile)

  function leaveGuestMode() {
    onClose()
    exitGuestMode()
  }

  function clearGuestData() {
    if (!window.confirm('Удалить все данные гостевого режима с этого устройства? Отменить это действие нельзя.')) return

    window.dispatchEvent(new Event(GUEST_DATA_CLEAR_EVENT))
    setGuestDataInfo('Локальные данные гостевого режима удалены.')
  }

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

  async function changeAnnualCycleEnabled(nextEnabled: boolean) {
    const previousEnabled = annualCycleEnabled
    setAnnualCycleEnabled(nextEnabled)
    setBusy(true)
    setError(null)
    try {
      await saveAnnualCycleEnabled(nextEnabled)
    } catch (err) {
      setAnnualCycleEnabled(previousEnabled)
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройку ежегодного цикла')
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

  async function onPinChange(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPinInfo(null)

    if (!/^\d{4}$/.test(newPin)) {
      setError('Новый пин должен состоять из четырёх цифр')
      return
    }
    if (newPin !== newPinConfirmation) {
      setError('Введённые пины не совпадают')
      return
    }

    setPinBusy(true)
    try {
      await verifyPassword(pinAccountPassword)
      await saveNegativeHabitsSecurity({ pin: newPin })
      setPinAccountPassword('')
      setNewPin('')
      setNewPinConfirmation('')
      setPinInfo('Пин успешно изменён.')
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Не удалось изменить пин'))
    } finally {
      setPinBusy(false)
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
                  ? 'Во время Шаббата доступно праздничное оформление.'
                  : isGuest
                    ? 'Тема сохраняется только в этом браузере.'
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
            <p className="hint">
              Весь текст Торы разбит на 54 еженедельные части. Каждая из них называется <strong>«парашат ха-шавуа»</strong> (недельная глава).
            </p>
            {!cityName && <p className="hint">Для праздничного оформления выберите город и сохраните календарь.</p>}
            <label className="toggle">
              <input
                type="checkbox"
                checked={annualCycleEnabled}
                onChange={(event) => changeAnnualCycleEnabled(event.target.checked)}
                disabled={busy}
              />
              Ежегодный цикл
            </label>
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

        {isAdmin && (
          <section className="settings-block">
            <h3>Администрирование</h3>
            <button
              type="button"
              className={`admin-mode-toggle${adminMode ? ' active' : ''}`}
              aria-pressed={adminMode}
              onClick={() => setAdminMode(!adminMode)}
            >
              Режим администратора
            </button>
          </section>
        )}

        <section className="settings-block">
          <h3>{isGuest ? 'Гостевой режим' : 'Профиль'}</h3>
          {isGuest ? (
            <div className="guest-storage-settings">
              <p className="banner info guest-privacy-note">
                Персональные данные сохраняются только на этом устройстве и не передаются в
                облачную базу. Они не синхронизируются и могут быть удалены браузером.
              </p>
              {guestDataInfo && <p className="banner info">{guestDataInfo}</p>}
              <div className="guest-storage-actions">
                <button type="button" className="danger compact" onClick={clearGuestData}>
                  Удалить локальные данные
                </button>
                <button type="button" className="ghost compact" onClick={leaveGuestMode}>
                  Выйти из гостевого режима
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="email">{user?.email}</p>
              <div className="profile-security-actions">
                <button
                  type="button"
                  className="primary compact settings-action"
                  aria-expanded={passwordFormOpen}
                  aria-controls="password-change-form"
                  onClick={() => setPasswordFormOpen((open) => !open)}
                >
                  Смена пароля
                </button>
                <button
                  type="button"
                  className="primary compact settings-action"
                  aria-expanded={pinFormOpen}
                  aria-controls="pin-change-form"
                  onClick={() => {
                    setPinFormOpen((open) => !open)
                    setError(null)
                    setPinInfo(null)
                  }}
                >
                  Сменить пин с подтверждением
                </button>
              </div>
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
              {pinFormOpen && (
                <form id="pin-change-form" onSubmit={onPinChange}>
                  <label>
                    Пароль учётной записи
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={pinAccountPassword}
                      onChange={(event) => setPinAccountPassword(event.target.value)}
                    />
                  </label>
                  <label>
                    Новый пин
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      required
                      value={newPin}
                      onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    />
                  </label>
                  <label>
                    Повторите новый пин
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      required
                      value={newPinConfirmation}
                      onChange={(event) => setNewPinConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    />
                  </label>
                  <button className="primary compact" type="submit" disabled={pinBusy}>
                    {pinBusy ? 'Проверка…' : 'Изменить пин'}
                  </button>
                </form>
              )}
              {pinInfo && <p className="banner info">{pinInfo}</p>}
              <button type="button" className="danger compact settings-action" onClick={() => signOut()}>
                Выйти из аккаунта
              </button>
            </>
          )}
        </section>

        {error && <p className="banner error">{error}</p>}
      </div>
    </div>
  )
}
