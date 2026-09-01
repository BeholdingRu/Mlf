import { useEffect, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { localISODate } from '../lib/dates'
import { applyTheme, getSavedTheme, normalizeTheme, themes, type ThemeId } from '../lib/theme'

type SettingsModalProps = {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    profile,
    tasks,
    weightLogs,
    addTask,
    updateTask,
    deleteTask,
    saveWeightSettings,
    saveWeightVisibility: persistWeightVisibility,
    logTodayWeight,
    saveCaloriesNorm,
    saveDesiredWeight,
    saveTheme,
  } = useData()
  const { user, signOut } = useAuth()
  const todayWeight = weightLogs.find((log) => log.logged_on === localISODate())
  const [enabled, setEnabled] = useState(profile?.weight_enabled ?? false)
  const [target, setTarget] = useState(
    profile?.target_weight != null ? String(profile.target_weight) : '',
  )
  const [currentWeight, setCurrentWeight] = useState(todayWeight ? String(todayWeight.value) : '')
  const [desired, setDesired] = useState(
    profile?.desired_weight != null ? String(profile.desired_weight) : '',
  )
  const [caloriesNorm, setCaloriesNorm] = useState(
    profile?.daily_calories_norm != null ? String(profile.daily_calories_norm) : '',
  )
  const [newTitle, setNewTitle] = useState('')
  const [newDays, setNewDays] = useState('21')
  const [edits, setEdits] = useState<Record<string, { title: string; habit_days: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nutritionInfoOpen, setNutritionInfoOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeId>(() =>
    profile ? normalizeTheme(profile.theme) : getSavedTheme(),
  )

  useEffect(() => {
    const next: Record<string, { title: string; habit_days: string }> = {}
    for (const task of tasks) {
      next[task.id] = { title: task.title, habit_days: String(task.habit_days) }
    }
    setEdits(next)
    setCaloriesNorm(profile?.daily_calories_norm != null ? String(profile.daily_calories_norm) : '')
  }, [tasks, profile?.daily_calories_norm])

  async function saveWeight() {
    setBusy(true)
    setError(null)
    try {
      const parsed = target.trim() === '' ? null : Number(target.replace(',', '.'))
      if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
        throw new Error('Укажите начальный вес больше нуля')
      }
      await saveWeightSettings(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить вес')
    } finally {
      setBusy(false)
    }
  }

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

  async function saveCurrentWeight() {
    setBusy(true)
    setError(null)
    try {
      const parsed = Number(currentWeight.replace(',', '.'))
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('Укажите текущий вес больше нуля')
      }
      await logTodayWeight(parsed)
      setCurrentWeight(String(parsed))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить текущий вес')
    } finally {
      setBusy(false)
    }
  }

  async function saveCalories() {
    setBusy(true)
    setError(null)
    try {
      const parsed = caloriesNorm.trim() === '' ? null : Number(caloriesNorm.replace(',', '.'))
      if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
        throw new Error('Укажите положительное значение для дневной нормы калорий')
      }
      await saveCaloriesNorm(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить дневную норму калорий')
    } finally {
      setBusy(false)
    }
  }

  async function saveDesired() {
    setBusy(true)
    setError(null)
    try {
      const parsed = desired.trim() === '' ? null : Number(desired.replace(',', '.'))
      if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
        throw new Error('Укажите положительное значение для желаемого веса')
      }
      await saveDesiredWeight(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить желаемый вес')
    } finally {
      setBusy(false)
    }
  }

  async function onAdd() {
    const title = newTitle.trim()
    const days = Number(newDays)
    if (!title) {
      setError('Введите название задачи')
      return
    }
    if (!Number.isInteger(days) || days < 1) {
      setError('Количество дней шкалы должно быть целым числом от 1')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addTask(title, days)
      setNewTitle('')
      setNewDays('21')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить задачу')
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
          <h3>Оформление</h3>
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
          <button type="button" className="primary compact" onClick={saveWeightVisibility} disabled={busy}>
            Сохранить отображение
          </button>
          
          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            <div>
              <label>
                Текущий вес
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  placeholder={todayWeight ? String(todayWeight.value) : 'например 72.4'}
                />
              </label>
              <p className="hint">
                {todayWeight
                  ? 'Вес за сегодня можно отредактировать.'
                  : 'Вес можно внести один раз в сутки.'}
              </p>
              <button type="button" className="primary compact" onClick={saveCurrentWeight} disabled={busy} style={{ marginTop: '8px' }}>
                {todayWeight ? 'Сохранить изменения' : 'Сохранить текущий вес'}
              </button>
            </div>

            <div>
              <label>
                Начальный вес
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <button type="button" className="primary compact" onClick={saveWeight} disabled={busy} style={{ marginTop: '8px' }}>
                Сохранить начальный вес
              </button>
            </div>

            <div>
              <label>
                Желаемый вес
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={desired}
                  onChange={(e) => setDesired(e.target.value)}
                />
              </label>
              <button type="button" className="primary compact" onClick={saveDesired} disabled={busy} style={{ marginTop: '8px' }}>
                Сохранить желаемый вес
              </button>
            </div>
          </div>
        </section>

        <section className="settings-block">
          <h3>Калории</h3>
          <label>
            Дневная норма калорий
            <input
              type="number"
              step="1"
              min="1"
              value={caloriesNorm}
              onChange={(e) => setCaloriesNorm(e.target.value)}
            />
          </label>
          <button type="button" className="primary compact" onClick={saveCalories} disabled={busy}>
            Сохранить
          </button>
        </section>

        <section className="settings-block">
          <h3>Задачи</h3>
          <p className="hint">
            Для каждой задачи укажите, сколько дней нужно, чтобы шкала «% формирования привычки»
            достигла 100%.
          </p>
          <div className="add-row">
            <input
              placeholder="Название задачи"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input
              type="number"
              min={1}
              className="days"
              value={newDays}
              onChange={(e) => setNewDays(e.target.value)}
              aria-label="Дней до 100%"
            />
            <button type="button" className="primary compact" onClick={onAdd} disabled={busy}>
              Добавить задачу
            </button>
          </div>

          <ul className="settings-tasks">
            {tasks.map((task) => {
              const edit = edits[task.id] ?? {
                title: task.title,
                habit_days: String(task.habit_days),
              }
              return (
                <li key={task.id}>
                  <input
                    value={edit.title}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [task.id]: { ...edit, title: e.target.value },
                      }))
                    }
                    aria-label="Название"
                  />
                  <input
                    type="number"
                    min={1}
                    className="days"
                    value={edit.habit_days}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [task.id]: { ...edit, habit_days: e.target.value },
                      }))
                    }
                    aria-label="Дней до заполнения шкалы"
                  />
                  <button
                    type="button"
                    className="ghost compact"
                    onClick={async () => {
                      const days = Number(edit.habit_days)
                      if (!edit.title.trim() || !Number.isInteger(days) || days < 1) {
                        setError('Проверьте название и число дней')
                        return
                      }
                      setBusy(true)
                      try {
                        await updateTask(task.id, {
                          title: edit.title.trim(),
                          habit_days: days,
                        })
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Ошибка сохранения')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="danger compact"
                    onClick={async () => {
                      if (!confirm(`Удалить задачу «${task.title}»?`)) return
                      await deleteTask(task.id)
                    }}
                  >
                    Удалить
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="settings-block">
          <h3>Профиль</h3>
          <p className="email">{user?.email}</p>
          <button type="button" className="danger compact" onClick={() => signOut()}>
            Выйти из аккаунта
          </button>
        </section>

        {error && <p className="banner error">{error}</p>}
      </div>
    </div>
  )
}
