import { HabitBar } from './HabitBar'
import { WeightChart } from './WeightChart'
import { useData } from '../context/DataContext'
import {
  daysInclusive,
  inRange,
  localISODate,
  percent,
  startOfMonth,
  startOfWeekMonday,
} from '../lib/dates'
import type { CabinetTab } from '../lib/types'

type StatsViewProps = {
  tab: Exclude<CabinetTab, 'daily'>
}

export function StatsView({ tab }: StatsViewProps) {
  const { tasks, completions, weightLogs, profile } = useData()
  const today = new Date()
  const todayIso = localISODate(today)

  const from =
    tab === 'week'
      ? localISODate(startOfWeekMonday(today))
      : tab === 'month'
        ? localISODate(startOfMonth(today))
        : null

  const periodDays =
    tab === 'week'
      ? daysInclusive(startOfWeekMonday(today), today)
      : tab === 'month'
        ? daysInclusive(startOfMonth(today), today)
        : null

  const title =
    tab === 'week'
      ? 'Недельная статистика'
      : tab === 'month'
        ? 'Месячная статистика'
        : 'Статистика за всё время'

  const subtitle =
    tab === 'week'
      ? `С понедельника (${from}) по сегодня. Процент = число отметок / ${periodDays} дн.`
      : tab === 'month'
        ? `С 1-го числа текущего месяца по сегодня. Процент = число отметок / ${periodDays} дн.`
        : 'Сколько дней вы отмечали каждую задачу'

  return (
    <section>
      <header className="page-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>

      {tab === 'all' && profile?.weight_enabled && (
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
            const count = completions.filter((c) => {
              if (c.task_id !== task.id) return false
              if (!from) return true
              return inRange(c.completed_on, from, todayIso)
            }).length
            const value = periodDays ? percent(count, periodDays) : percent(count, task.habit_days)
            return (
              <li key={task.id} className="task-row stat">
                <div className="task-body">
                  <strong>{task.title}</strong>
                  <span className="hint">
                    {tab === 'all'
                      ? `${count} ${daysWord(count)} отмечено`
                      : `${count} из ${periodDays ?? 0} ${daysWord(periodDays ?? 0)}`}
                  </span>
                </div>
                <HabitBar
                  value={value}
                  label={tab === 'all' ? 'формирование привычки' : 'выполнение за период'}
                />
              </li>
            )
          })}
        </ul>
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
