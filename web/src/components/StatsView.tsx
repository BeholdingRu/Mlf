import { HabitBar } from './HabitBar'
import { WeightChart } from './WeightChart'
import { useData } from '../context/DataContext'
import { percent } from '../lib/dates'

export function StatsView() {
  const { tasks, completions, weightLogs, profile } = useData()

  return (
    <section>
      <header className="page-head">
        <h2>Статистика</h2>
        <p>Сколько дней вы отмечали каждую задачу</p>
      </header>

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
                  <span className="hint">{count} {daysWord(count)} отмечено</span>
                </div>
                <HabitBar value={percent(count, task.habit_days)} label="формирование привычки" />
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
