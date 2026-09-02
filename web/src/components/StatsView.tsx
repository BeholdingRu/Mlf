import { useState } from 'react'
import { HabitBar } from './HabitBar'
import { WeightChart } from './WeightChart'
import { useData } from '../context/DataContext'
import { percent } from '../lib/dates'

type StatsSubTab = 'overview' | 'manage-weight'

export function StatsView() {
  const { tasks, completions, weightLogs, profile, saveWeightSettings, saveDesiredWeight } = useData()
  const [subTab, setSubTab] = useState<StatsSubTab>('overview')
  const [target, setTarget] = useState(
    profile?.target_weight != null ? String(profile.target_weight) : '',
  )
  const [desired, setDesired] = useState(
    profile?.desired_weight != null ? String(profile.desired_weight) : '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <section className="stats-view">
      <nav className="daily-tasks-tabs" aria-label="Разделы статистики">
        <button
          type="button"
          className={subTab === 'overview' ? 'daily-tasks-tab statistics-tab active' : 'daily-tasks-tab statistics-tab'}
          onClick={() => setSubTab('overview')}
          aria-label="Статистика"
          title="Статистика"
        >
          <img className="statistics-tab-icon" src="/icons/statistic.png" alt="" />
        </button>
        <button
          type="button"
          className={subTab === 'manage-weight' ? 'daily-tasks-tab task-settings-tab active' : 'daily-tasks-tab task-settings-tab'}
          onClick={() => setSubTab('manage-weight')}
          aria-label="Настроить вес"
          title="Настроить вес"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </nav>

      {subTab === 'overview' ? (
        <>
          {profile?.weight_enabled && (
            <WeightChart
              logs={weightLogs}
              startDate={profile.weight_started_on}
              startWeight={profile.target_weight}
              desiredWeight={profile.desired_weight}
            />
          )}

          {!tasks.length ? (
            <div className="empty">Нет задач для статистики.</div>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => {
                const count = completions.filter((completion) => completion.task_id === task.id).length
                return (
                  <li key={task.id} className="task-row stat">
                    <div className="task-body">
                      <strong>{task.title}</strong>
                      <span className="hint">{completedDaysText(count)}</span>
                    </div>
                    <HabitBar value={percent(count, task.habit_days)} label="формирование привычки" />
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        <div className="weight-settings">
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
            <button type="button" className="primary compact" onClick={saveWeight} disabled={busy}>
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
            <button type="button" className="primary compact" onClick={saveDesired} disabled={busy}>
              Сохранить желаемый вес
            </button>
          </div>
          {error && <p className="banner error">{error}</p>}
        </div>
      )}
    </section>
  )
}

function daysWord(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

function completedDaysText(count: number) {
  const singular = count % 10 === 1 && count % 100 !== 11
  return `${count} ${daysWord(count)} ${singular ? 'завершён' : 'завершено'} успешно`
}
