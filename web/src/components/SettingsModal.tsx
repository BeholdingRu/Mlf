import { useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { getAuthErrorMessage } from '../lib/auth-errors'
import {
  applyFontScale,
  applyTheme,
  fontScales,
  getSavedFontScale,
  getSavedTheme,
  normalizeFontScale,
  normalizeTheme,
  themes,
  type FontScale,
  type ThemeId,
} from '../lib/theme'

type SettingsModalProps = {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    profile,
    saveWeightVisibility: persistWeightVisibility,
    saveFontScale,
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

  async function saveWeightVisibility() {
    setBusy(true)
    setError(null)
    try {
      await persistWeightVisibility(enabled)
    } catch (err) {
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
              <p className="hint">Тема сохраняется в профиле и будет доступна на всех устройствах.</p>
              <div className="theme-options" role="radiogroup" aria-label="Выбор темы">
                {themes.map((option) => (
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
          <div className="weight-visibility-setting">
            <label className="toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
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
          <button
            type="button"
            className="primary compact settings-action"
            onClick={saveWeightVisibility}
            disabled={busy}
          >
            Сохранить отображение
          </button>
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
