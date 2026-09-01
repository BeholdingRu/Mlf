import { useState } from 'react'
import { HabitBar } from './HabitBar'
import { useData } from '../context/DataContext'
import { localISODate, percent } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'

export function DailyTasks() {
  const { tasks, completions, completeToday, profile } = useData()
  const [busyId, setBusyId] = useState<string | null>(null)
  const today = localISODate()

  if (!tasks.length) {
    return (
      <div className="empty">
        Пока нет задач. Откройте настройки и добавьте первую привычку.
      </div>
    )
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => {
        const doneToday = completions.some(
          (c) => c.task_id === task.id && c.completed_on === today,
        )
        const totalDays = completions.filter((c) => c.task_id === task.id).length
        const habit = percent(totalDays, task.habit_days)
        const automaticNutritionTask = profile?.weight_enabled && isNutritionTask(task)
        return (
          <li
            key={task.id}
            className={`task-row${doneToday ? ' done' : ''}${automaticNutritionTask ? ' automatic' : ''}`}
          >
            <button
              type="button"
              className="check"
              disabled={busyId === task.id || doneToday || automaticNutritionTask}
              onClick={async () => {
                setBusyId(task.id)
                try {
                  await completeToday(task.id)
                } finally {
                  setBusyId(null)
                }
              }}
              aria-pressed={doneToday}
              aria-label={
                automaticNutritionTask
                  ? 'Ручное выполнение недоступно: задача отмечается автоматически по калориям'
                  : doneToday
                    ? 'Выполнено сегодня'
                    : 'Отметить выполнение'
              }
            >
              {doneToday ? '✓' : ''}
            </button>
            <div className="task-body">
              <strong>{task.title}</strong>
              <span className="hint">
                {automaticNutritionTask
                  ? doneToday
                    ? 'Выполнено автоматически по дневной норме калорий'
                    : 'Будет отмечена автоматически в 00:00, если норма калорий не превышена'
                  : doneToday
                    ? 'Выполнено сегодня'
                    : 'Можно отметить один раз в сутки'}
              </span>
            </div>
            <HabitBar value={habit} />
          </li>
        )
      })}
    </ul>
  )
}
