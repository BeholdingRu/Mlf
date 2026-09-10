import { useEffect, useState } from 'react'
import { HabitBar } from './HabitBar'
import { WeightChart } from './WeightChart'
import { useData } from '../hooks/useData'
import { localISODate, percent } from '../lib/dates'
import { getWithdrawalPhase } from '../lib/withdrawal-phase'
import type { WeightLog } from '../lib/types'

type StatsSubTab = 'overview' | 'manage-weight'

const STATS_SUB_TAB_STORAGE_KEY = 'mlf:stats-sub-tab'
const STATS_TEST_WEIGHT_LOGS_STORAGE_KEY = 'mlf:stats-test-weight-logs'

function getSavedStatsSubTab(): StatsSubTab {
  return window.sessionStorage.getItem(STATS_SUB_TAB_STORAGE_KEY) === 'manage-weight'
    ? 'manage-weight'
    : 'overview'
}

function getSavedTestWeightLogs(): WeightLog[] {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STATS_TEST_WEIGHT_LOGS_STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(saved)) return []
    return saved.filter((item): item is WeightLog => Boolean(
      item
      && typeof item === 'object'
      && typeof (item as WeightLog).id === 'string'
      && typeof (item as WeightLog).logged_on === 'string'
      && typeof (item as WeightLog).value === 'number',
    ))
  } catch {
    window.sessionStorage.removeItem(STATS_TEST_WEIGHT_LOGS_STORAGE_KEY)
    return []
  }
}

export function StatsView() {
  const { tasks, completions, weightLogs, profile, saveWeightSettings, saveDesiredWeight, adminMode } = useData()
  const [subTab, setSubTab] = useState<StatsSubTab>(getSavedStatsSubTab)
  const [target, setTarget] = useState(
    profile?.target_weight != null ? String(profile.target_weight) : '',
  )
  const [desired, setDesired] = useState(
    profile?.desired_weight != null ? String(profile.desired_weight) : '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testDate, setTestDate] = useState(localISODate)
  const [testWeight, setTestWeight] = useState('')
  const [testWeightLogs, setTestWeightLogs] = useState<WeightLog[]>(getSavedTestWeightLogs)

  const testDates = new Set(testWeightLogs.map((log) => log.logged_on))
  const chartWeightLogs = adminMode
    ? [...weightLogs.filter((log) => !testDates.has(log.logged_on)), ...testWeightLogs]
    : weightLogs

  useEffect(() => {
    window.sessionStorage.setItem(STATS_SUB_TAB_STORAGE_KEY, subTab)
  }, [subTab])

  useEffect(() => {
    window.sessionStorage.setItem(STATS_TEST_WEIGHT_LOGS_STORAGE_KEY, JSON.stringify(testWeightLogs))
  }, [testWeightLogs])

  function addTestWeightLog() {
    const value = Number(testWeight.replace(',', '.'))
    if (!testDate || !Number.isFinite(value) || value <= 0) {
      setError('Укажите тестовую дату и вес больше нуля')
      return
    }

    setTestWeightLogs((logs) => [
      ...logs.filter((log) => log.logged_on !== testDate),
      {
        id: `test-${testDate}`,
        user_id: 'test',
        logged_on: testDate,
        value,
      },
    ])
    setError(null)
  }

  function fillTestWeightLogs() {
    const availableLogs = [...chartWeightLogs].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
    const latestLog = availableLogs[availableLogs.length - 1]
    const baseDate = latestLog?.logged_on ?? profile?.weight_started_on
    const baseWeight = latestLog?.value ?? profile?.target_weight

    if (!baseDate || baseWeight == null) {
      setError('Сначала укажите начальный вес или добавьте тестовую запись')
      return
    }

    const nextMonday = new Date(`${baseDate}T00:00:00`)
    const weekday = nextMonday.getDay()
    nextMonday.setDate(nextMonday.getDate() + (weekday === 1 ? 7 : (8 - weekday) % 7))

    const generatedLogs = Array.from({ length: 4 }, (_, index): WeightLog => {
      const date = new Date(nextMonday)
      date.setDate(nextMonday.getDate() + index * 7)
      const loggedOn = localISODate(date)
      return {
        id: `test-${loggedOn}`,
        user_id: 'test',
        logged_on: loggedOn,
        value: Math.max(0.1, baseWeight - index - 1),
      }
    })

    setTestWeightLogs((logs) => {
      const generatedDates = new Set(generatedLogs.map((log) => log.logged_on))
      return [...logs.filter((log) => !generatedDates.has(log.logged_on)), ...generatedLogs]
    })
    setTestDate(generatedLogs[generatedLogs.length - 1].logged_on)
    setTestWeight(String(generatedLogs[generatedLogs.length - 1].value))
    setError(null)
  }

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
            <>
              {adminMode && (
                <div className="stats-test-weight-panel">
                  <label>
                    Тестовая дата
                    <input type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} />
                  </label>
                  <label>
                    Вес
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={testWeight}
                      onChange={(event) => setTestWeight(event.target.value)}
                      placeholder="кг"
                    />
                  </label>
                  <button type="button" className="primary compact" onClick={addTestWeightLog}>
                    Добавить тестовую запись
                  </button>
                  {testWeightLogs.length > 0 && (
                    <button
                      type="button"
                      className="ghost compact"
                      onClick={() => setTestWeightLogs([])}
                    >
                      Очистить тестовые записи ({testWeightLogs.length})
                    </button>
                  )}
                  <button type="button" className="ghost compact" onClick={fillTestWeightLogs}>
                    Тестовое заполнение
                  </button>
                  <span className="hint">Данные добавляются только на график и не сохраняются в базе.</span>
                  {error && <p className="banner error">{error}</p>}
                </div>
              )}
              <WeightChart
                logs={chartWeightLogs}
                startDate={profile.weight_started_on}
                startWeight={profile.target_weight}
                desiredWeight={profile.desired_weight}
              />
            </>
          )}

          {!tasks.length ? (
            <div className="empty">Нет задач для статистики.</div>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => {
                const withdrawalPhase = getWithdrawalPhase(
                  task.withdrawal_syndrome,
                  task.withdrawal_started_on,
                  task.withdrawal_restart_on,
                  localISODate(),
                )
                if (withdrawalPhase) {
                  const habit = percent(withdrawalPhase.remainingDays, withdrawalPhase.durationDays)
                  return (
                    <li key={task.id} className={`task-row stat withdrawal-${withdrawalPhase.tone}`}>
                      <div className="task-body">
                        <strong>{task.title}</strong>
                        <span className="hint">
                          {withdrawalPhase.preparing ? 'Перезапуск запланирован на завтра' : 'Отсчёт фазы выполняется автоматически'}
                        </span>
                      </div>
                      <HabitBar
                        value={habit}
                        label={withdrawalPhase.label}
                        valueLabel={withdrawalPhase.preparing ? null : withdrawalPhase.clean ? `${withdrawalPhase.freedomDays} дней свободы` : `осталось ${withdrawalPhase.remainingDays} дн.`}
                        phaseInfo={withdrawalPhase.info}
                        hideTrack={withdrawalPhase.clean}
                      />
                    </li>
                  )
                }

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
