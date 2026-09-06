import { useEffect, useState } from 'react'
import { HabitBar } from './HabitBar'
import { useData } from '../hooks/useData'
import { daysInclusive, localISODate, parseISODate, percent } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'

type DailyTasksSubTab = 'list' | 'manage'

const DAILY_TASKS_SUB_TAB_STORAGE_KEY = 'mlf:daily-tasks-sub-tab'
const TASK_SETTINGS_DRAFT_STORAGE_KEY = 'mlf:task-settings-draft'
const WITHDRAWAL_TEST_DATE_STORAGE_KEY = 'mlf:withdrawal-test-date'
const WITHDRAWAL_PHASE_INFO = {
  acute: 'Острая фаза. Начинается при снижении концентрации вещества в крови ниже порогового уровня. Для большинства веществ это происходит через 6–48 часов после последнего приёма. В этот период симптомы проявляются наиболее ярко: развиваются вегетативные кризы (потливость, тахикардия, тремор), тревога, бессонница или, наоборот, гиперсомния. Максимальная выраженность симптомов часто приходится на первые 1–4 дня.',
  subacute: 'Подострая (постабстинентная) фаза. Длится от нескольких дней до нескольких недель. Примечание автора: в моём случае она может длиться до 90 суток. Острые физические проявления стихают, но сохраняются нарушения сна, перепады настроения, раздражительность, трудности с концентрацией внимания и ангедония (неспособность получать удовольствие). Например, при отмене амфетамина эта фаза может длиться около трёх недель и характеризуется лёгкой гиперсомнией и повышенным аппетитом.',
  prolonged: 'Фаза длительного восстановления (пролонгированный синдром отмены — PAWS). Может продолжаться от нескольких месяцев до года и более. Это состояние не всегда фиксируется как острое заболевание, но проявляется волнообразно: внезапными приступами тяги, эмоциональной нестабильностью и астенией. Исследования показывают, что такая затяжная абстиненция характерна для отмены бензодиазепинов, антидепрессантов (СИОЗС) и длительного употребления опиоидов.',
  clean: 'В психологии есть понятие: «давно не делал» = «никогда не делал». Ваши нейронные связи свободны от зависимости, но помните: один раз алкоголик — навсегда алкоголик. Не позволяйте даже малейшему триггеру поколебать вас. Успехов!',
} as const

type TaskEditDraft = {
  title: string
  habit_days: string
}

type TaskSettingsDraft = {
  newTitle: string
  newDays: string
  newWithdrawalSyndrome: boolean
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
      || (draft.newWithdrawalSyndrome !== undefined && typeof draft.newWithdrawalSyndrome !== 'boolean')
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
      newWithdrawalSyndrome: draft.newWithdrawalSyndrome ?? false,
      edits: draft.edits,
    }
  } catch {
    window.sessionStorage.removeItem(TASK_SETTINGS_DRAFT_STORAGE_KEY)
    return null
  }
}

export function DailyTasks() {
  const { tasks, completions, completeToday, profile, addTask, updateTask, restartWithdrawalTask, deleteTask, adminMode } = useData()
  const [taskSettingsDraft] = useState<TaskSettingsDraft | null>(getSavedTaskSettingsDraft)
  const [subTab, setSubTab] = useState<DailyTasksSubTab>(getSavedDailyTasksSubTab)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState(taskSettingsDraft?.newTitle ?? '')
  const [newDays, setNewDays] = useState(taskSettingsDraft?.newDays ?? '21')
  const [newWithdrawalSyndrome, setNewWithdrawalSyndrome] = useState(taskSettingsDraft?.newWithdrawalSyndrome ?? false)
  const [withdrawalSyndromeInfoOpen, setWithdrawalSyndromeInfoOpen] = useState(false)
  const [taskEditorOpen, setTaskEditorOpen] = useState(false)
  const [edits, setEdits] = useState<Record<string, TaskEditDraft>>(taskSettingsDraft?.edits ?? {})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const today = localISODate()
  const [testDate, setTestDate] = useState(() => window.sessionStorage.getItem(WITHDRAWAL_TEST_DATE_STORAGE_KEY) ?? today)
  const testToday = adminMode && testDate ? testDate : today

  useEffect(() => {
    window.sessionStorage.setItem(DAILY_TASKS_SUB_TAB_STORAGE_KEY, subTab)
  }, [subTab])

  useEffect(() => {
    if (!newTitle && newDays === '21' && !newWithdrawalSyndrome && Object.keys(edits).length === 0) {
      window.sessionStorage.removeItem(TASK_SETTINGS_DRAFT_STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(
      TASK_SETTINGS_DRAFT_STORAGE_KEY,
      JSON.stringify({ newTitle, newDays, newWithdrawalSyndrome, edits }),
    )
  }, [edits, newDays, newTitle, newWithdrawalSyndrome])

  useEffect(() => {
    window.sessionStorage.setItem(WITHDRAWAL_TEST_DATE_STORAGE_KEY, testDate)
  }, [testDate])

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
      await addTask(title, days, newWithdrawalSyndrome)
      setNewTitle('')
      setNewDays('21')
      setNewWithdrawalSyndrome(false)
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
          <>
            {adminMode && (
              <label className="withdrawal-test-date">
                Тестовая дата
                <input
                  type="date"
                  value={testDate}
                  onChange={(event) => setTestDate(event.target.value)}
                />
                <span className="hint">Используется только для тестового отображения прогресса задач в этой вкладке.</span>
              </label>
            )}
            <ul className="task-list">
              {tasks.map((task) => {
              const withdrawalPhase = getWithdrawalPhase(
                task.withdrawal_syndrome,
                task.withdrawal_started_on,
                task.withdrawal_restart_on,
                testToday,
              )
              const doneToday = completions.some(
                (c) => c.task_id === task.id && c.completed_on === today,
              )
              const actualTotalDays = completions.filter((c) => c.task_id === task.id).length
              const totalDays = adminMode && !task.withdrawal_syndrome
                ? getVirtualCompletionDays(task.created_at, testToday)
                : actualTotalDays
              const habitFormed = !task.withdrawal_syndrome && totalDays >= task.habit_days
              const habit = withdrawalPhase ? percent(withdrawalPhase.remainingDays, withdrawalPhase.durationDays) : percent(totalDays, task.habit_days)
              const automaticNutritionTask = profile?.weight_enabled && isNutritionTask(task)
              return (
                <li
                  key={task.id}
                  className={`task-row${doneToday && !habitFormed ? ' done' : ''}${automaticNutritionTask ? ' automatic' : ''}${habitFormed ? ' habit-formed' : ''}${withdrawalPhase ? ` withdrawal-${withdrawalPhase.tone}` : ''}`}
                >
                  {withdrawalPhase ? (
                    <button
                      type="button"
                      className="ghost compact withdrawal-restart-button"
                      disabled={busyId === task.id || withdrawalPhase.preparing}
                      aria-label="Начать заново"
                      title="Начать заново"
                      onClick={async () => {
                        if (!window.confirm('Вы подтверждаете прерывание задачи?')) return
                        setBusyId(task.id)
                        try {
                          await restartWithdrawalTask(task.id)
                          window.alert('Завтра отсчёт начнётся сначала. Не сдавайтесь!')
                        } finally {
                          setBusyId(null)
                        }
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20 11a8 8 0 1 1-2.34-5.66L20 8" />
                        <path d="M20 3v5h-5" />
                      </svg>
                    </button>
                  ) : !habitFormed && (
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
                  )}
                  <div className="task-body">
                    <strong>{task.title}</strong>
                    {!habitFormed && (
                      <span className="hint">
                        {automaticNutritionTask
                          ? doneToday
                            ? 'Выполнено автоматически по дневной норме калорий'
                            : 'Будет отмечена автоматически в 00:00, если норма калорий не превышена'
                          : withdrawalPhase
                            ? withdrawalPhase.preparing
                              ? 'Перезапуск запланирован на завтра'
                              : 'Отсчёт фазы выполняется автоматически'
                            : doneToday
                              ? 'Выполнено сегодня'
                              : 'Можно отметить один раз в сутки'}
                      </span>
                    )}
                  </div>
                  <HabitBar
                    value={habit}
                    label={withdrawalPhase?.label ?? (habitFormed ? 'привычка сформирована' : undefined)}
                    valueLabel={withdrawalPhase ? withdrawalPhase.preparing ? null : withdrawalPhase.clean ? `${withdrawalPhase.freedomDays} дней свободы` : `осталось ${withdrawalPhase.remainingDays} дн.` : undefined}
                    phaseInfo={withdrawalPhase?.info}
                    hideTrack={withdrawalPhase?.clean}
                  />
                </li>
              )
            })}
            </ul>
          </>
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
            <div className="withdrawal-syndrome-setting">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={newWithdrawalSyndrome}
                  onChange={(event) => setNewWithdrawalSyndrome(event.target.checked)}
                />
                <span>Синдром отмены</span>
              </label>
              <button
                type="button"
                className="info-button"
                aria-label="Информация о синдроме отмены"
                aria-expanded={withdrawalSyndromeInfoOpen}
                aria-controls="withdrawal-syndrome-info"
                onClick={() => setWithdrawalSyndromeInfoOpen((open) => !open)}
              >
                i
              </button>
              {withdrawalSyndromeInfoOpen && (
                <p id="withdrawal-syndrome-info" className="withdrawal-syndrome-info">
                  Если у вас есть биохимическая зависимость (алкогольная, никотиновая или другая), вы можете использовать эту функцию. Она покажет, сколько примерно времени осталось до момента, когда зависимость перестанет влиять на вашу жизнь. Всего будет три этапа: острый, подострый и пролонгированный. Отмечать эту задачу не нужно: она будет фиксироваться как выполненная автоматически. Сроки этапов взяты из личного опыта автора; это максимальные сроки, которые приводят различные исследования.
                </p>
              )}
            </div>
            {!newWithdrawalSyndrome && (
              <input
                type="number"
                min={1}
                className="days"
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
                aria-label="Дней до 100%"
              />
            )}
            <button type="button" className="primary compact" onClick={onAdd} disabled={busy}>
              Добавить задачу
            </button>
          </div>

          <button
            type="button"
            className="ghost compact task-editor-toggle"
            aria-expanded={taskEditorOpen}
            aria-controls="task-settings-list"
            onClick={() => setTaskEditorOpen((open) => !open)}
          >
            {taskEditorOpen ? 'Скрыть редактирование' : 'Редактировать задачи/привычки'}
          </button>

          {taskEditorOpen && (
            <ul id="task-settings-list" className="task-settings-list">
              {tasks.map((task) => {
                const edit = edits[task.id] ?? {
                  title: task.title,
                  habit_days: String(task.habit_days),
                }
                return (
                  <li key={task.id} className={`task-editor-row${task.withdrawal_syndrome ? ' withdrawal-task-editor-row' : ''}`}>
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
                    {!task.withdrawal_syndrome && (
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
                    )}
                    <button
                      type="button"
                      className="ghost compact"
                      disabled={busy}
                      onClick={async () => {
                        const days = Number(edit.habit_days)
                        if (!edit.title.trim() || (!task.withdrawal_syndrome && (!Number.isInteger(days) || days < 1))) {
                          setError('Проверьте название и число дней')
                          return
                        }
                        setBusy(true)
                        setError(null)
                        try {
                          await updateTask(task.id, task.withdrawal_syndrome
                            ? { title: edit.title.trim() }
                            : { title: edit.title.trim(), habit_days: days },
                          )
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
          )}
          {error && <p className="banner error">{error}</p>}
        </div>
      )}
    </section>
  )
}

function getWithdrawalPhase(
  withdrawalSyndrome: boolean,
  startedOn: string | null,
  restartOn: string | null,
  today: string,
) {
  if (!withdrawalSyndrome || !startedOn) return null

  if (restartOn && restartOn > today) {
    return { durationDays: 1, label: 'Подготовка', tone: 'preparing' as const, remainingDays: 1, preparing: true }
  }

  const effectiveStartedOn = restartOn && restartOn <= today ? restartOn : startedOn
  const elapsedDays = Math.max(daysInclusive(parseISODate(effectiveStartedOn), parseISODate(today)) - 1, 0)
  const phases = [
    { durationDays: 4, label: 'Острая фаза', tone: 'acute', info: WITHDRAWAL_PHASE_INFO.acute },
    { durationDays: 90, label: 'Подострая фаза', tone: 'subacute', info: WITHDRAWAL_PHASE_INFO.subacute },
    { durationDays: 636, label: 'Длительная фаза', tone: 'prolonged', info: WITHDRAWAL_PHASE_INFO.prolonged },
  ] as const
  let passedDays = 0

  for (const phase of phases) {
    const remainingDays = phase.durationDays - (elapsedDays - passedDays)
    if (remainingDays > 0) return { ...phase, remainingDays, preparing: false }
    passedDays += phase.durationDays
  }

  return {
    durationDays: 636,
    label: 'Чистота',
    tone: 'clean' as const,
    info: WITHDRAWAL_PHASE_INFO.clean,
    remainingDays: 0,
    freedomDays: elapsedDays,
    preparing: false,
    clean: true,
  }
}

function getVirtualCompletionDays(createdAt: string, testDate: string): number {
  const createdOn = createdAt.slice(0, 10)
  if (testDate < createdOn) return 0
  return daysInclusive(parseISODate(createdOn), parseISODate(testDate))
}
