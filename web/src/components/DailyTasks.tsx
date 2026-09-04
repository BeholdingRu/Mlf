import { useEffect, useState } from 'react'
import { HabitBar } from './HabitBar'
import { useData } from '../context/DataContext'
import { localISODate, percent } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'

type DailyTasksSubTab = 'list' | 'manage'

const DAILY_TASKS_SUB_TAB_STORAGE_KEY = 'mlf:daily-tasks-sub-tab'
const TASK_SETTINGS_DRAFT_STORAGE_KEY = 'mlf:task-settings-draft'

type TaskEditDraft = {
  title: string
  habit_days: string
}

type TaskSettingsDraft = {
  newTitle: string
  newDays: string
  edits: Record<string, TaskEditDraft>
}

function getSavedDailyTasksSubTab(): DailyTasksSubTab {
  return window.sessionStorage.getItem(DAILY_TASKS_SUB_TAB_STORAGE_KEY) === 'manage'
    ? 'manage'
    : 'list'
}

function getSavedTaskSettingsDraft(): TaskSettingsDraft | null {
  try {
    const savedDraft = window.sessionStorage.getItem(TASK_SETTINGS_DRAFT_STORAGE_KEY)
    if (!savedDraft) return null

    const draft = JSON.parse(savedDraft) as Partial<TaskSettingsDraft>
    if (
      typeof draft.newTitle !== 'string'
      || typeof draft.newDays !== 'string'
      || !draft.edits
      || typeof draft.edits !== 'object'
      || Object.values(draft.edits).some(
        (edit) => !edit || typeof edit.title !== 'string' || typeof edit.habit_days !== 'string',
      )
    ) {
      window.sessionStorage.removeItem(TASK_SETTINGS_DRAFT_STORAGE_KEY)
      return null
    }

    return {
      newTitle: draft.newTitle,
      newDays: draft.newDays,
      edits: draft.edits,
    }
  } catch {
    window.sessionStorage.removeItem(TASK_SETTINGS_DRAFT_STORAGE_KEY)
    return null
  }
}

export function DailyTasks() {
  const { tasks, completions, completeToday, profile, addTask, updateTask, deleteTask } = useData()
  const [taskSettingsDraft] = useState<TaskSettingsDraft | null>(getSavedTaskSettingsDraft)
  const [subTab, setSubTab] = useState<DailyTasksSubTab>(getSavedDailyTasksSubTab)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState(taskSettingsDraft?.newTitle ?? '')
  const [newDays, setNewDays] = useState(taskSettingsDraft?.newDays ?? '21')
  const [edits, setEdits] = useState<Record<string, TaskEditDraft>>(taskSettingsDraft?.edits ?? {})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const today = localISODate()

  useEffect(() => {
    window.sessionStorage.setItem(DAILY_TASKS_SUB_TAB_STORAGE_KEY, subTab)
  }, [subTab])

  useEffect(() => {
    if (!newTitle && newDays === '21' && Object.keys(edits).length === 0) {
      window.sessionStorage.removeItem(TASK_SETTINGS_DRAFT_STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(TASK_SETTINGS_DRAFT_STORAGE_KEY, JSON.stringify({ newTitle, newDays, edits }))
  }, [edits, newDays, newTitle])

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

  return (
    <section className="daily-tasks-view">
      <nav className="daily-tasks-tabs" aria-label="Разделы ежедневных задач">
        <button
          type="button"
          className={subTab === 'list' ? 'daily-tasks-tab active' : 'daily-tasks-tab'}
          onClick={() => setSubTab('list')}
        >
          Задачи
        </button>
        <button
          type="button"
          className={subTab === 'manage' ? 'daily-tasks-tab task-settings-tab active' : 'daily-tasks-tab task-settings-tab'}
          onClick={() => setSubTab('manage')}
          aria-label="Настроить задачи"
          title="Настроить задачи"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </nav>

      {subTab === 'list' ? (
        tasks.length ? (
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
        ) : (
          <div className="empty">Пока нет задач. Добавьте первую привычку в настройках задач.</div>
        )
      ) : (
        <div className="task-settings">
          <p className="hint">
            Для каждой задачи укажите, сколько дней нужно, чтобы шкала «% формирования привычки»
            достигла 100%.
          </p>
          <div className="task-editor-add">
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

          <ul className="task-settings-list">
            {tasks.map((task) => {
              const edit = edits[task.id] ?? {
                title: task.title,
                habit_days: String(task.habit_days),
              }
              return (
                <li key={task.id} className="task-editor-row">
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
                    disabled={busy}
                    onClick={async () => {
                      const days = Number(edit.habit_days)
                      if (!edit.title.trim() || !Number.isInteger(days) || days < 1) {
                        setError('Проверьте название и число дней')
                        return
                      }
                      setBusy(true)
                      setError(null)
                      try {
                        await updateTask(task.id, {
                          title: edit.title.trim(),
                          habit_days: days,
                        })
                        setEdits((prev) => {
                          const { [task.id]: _, ...next } = prev
                          return next
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
                    disabled={busy}
                    onClick={async () => {
                      if (!confirm(`Удалить задачу «${task.title}»?`)) return
                      setBusy(true)
                      setError(null)
                      try {
                        await deleteTask(task.id)
                        setEdits((prev) => {
                          const { [task.id]: _, ...next } = prev
                          return next
                        })
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Ошибка удаления')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Удалить
                  </button>
                </li>
              )
            })}
          </ul>
          {error && <p className="banner error">{error}</p>}
        </div>
      )}
    </section>
  )
}
