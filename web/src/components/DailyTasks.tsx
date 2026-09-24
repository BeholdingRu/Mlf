import { useEffect, useState } from 'react'
import { HabitBar } from './HabitBar'
import { useData } from '../hooks/useData'
import { daysInclusive, localISODate, parseISODate, percent } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'
import { getRegularTaskProgressDays } from '../lib/task-progress'
import { getWithdrawalPhase } from '../lib/withdrawal-phase'
import { isBibleReadingTaskTitle } from '../lib/bible-books'

type DailyTasksSubTab = 'list' | 'manage'

const DAILY_TASKS_SUB_TAB_STORAGE_KEY = 'mlf:daily-tasks-sub-tab'
const TASK_SETTINGS_DRAFT_STORAGE_KEY = 'mlf:task-settings-draft'
const WITHDRAWAL_TEST_DATE_STORAGE_KEY = 'mlf:withdrawal-test-date'
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

export function DailyTasks({ onContinueBibleReading }: { onContinueBibleReading?: () => void }) {
  const {
    tasks,
    completions,
    completeToday,
    profile,
    addTask,
    updateTask,
    restartWithdrawalTask,
    deleteTask,
    saveNegativeHabitsSecurity,
    adminMode,
  } = useData()
  const [taskSettingsDraft] = useState<TaskSettingsDraft | null>(getSavedTaskSettingsDraft)
  const [subTab, setSubTab] = useState<DailyTasksSubTab>(getSavedDailyTasksSubTab)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState(taskSettingsDraft?.newTitle ?? '')
  const [newDays, setNewDays] = useState(taskSettingsDraft?.newDays ?? '21')
  const [newWithdrawalSyndrome, setNewWithdrawalSyndrome] = useState(taskSettingsDraft?.newWithdrawalSyndrome ?? false)
  const [withdrawalSyndromeInfoOpen, setWithdrawalSyndromeInfoOpen] = useState(false)
  const [negativeHabitsListOpen, setNegativeHabitsListOpen] = useState(false)
  const [negativeHabitsSettingsOpen, setNegativeHabitsSettingsOpen] = useState(false)
  const [negativeHabitsListPinOpen, setNegativeHabitsListPinOpen] = useState(false)
  const [negativeHabitsSettingsPinOpen, setNegativeHabitsSettingsPinOpen] = useState(false)
  const [negativeHabitsListPin, setNegativeHabitsListPin] = useState('')
  const [negativeHabitsSettingsPin, setNegativeHabitsSettingsPin] = useState('')
  const [negativeHabitsListPinError, setNegativeHabitsListPinError] = useState<string | null>(null)
  const [negativeHabitsSettingsPinError, setNegativeHabitsSettingsPinError] = useState<string | null>(null)
  const [newNegativeHabitPin, setNewNegativeHabitPin] = useState('')
  const [negativeHabitsChangePinOpen, setNegativeHabitsChangePinOpen] = useState(false)
  const [currentNegativeHabitPin, setCurrentNegativeHabitPin] = useState('')
  const [replacementNegativeHabitPin, setReplacementNegativeHabitPin] = useState('')
  const [negativeHabitsEnablePinOpen, setNegativeHabitsEnablePinOpen] = useState(false)
  const [negativeHabitsEnablePin, setNegativeHabitsEnablePin] = useState('')
  const [negativeHabitsEnablePinError, setNegativeHabitsEnablePinError] = useState<string | null>(null)
  const [negativeHabitsSecurityBusy, setNegativeHabitsSecurityBusy] = useState(false)
  const [negativeHabitsSecurityError, setNegativeHabitsSecurityError] = useState<string | null>(null)
  const [negativeHabitsSecurityMessage, setNegativeHabitsSecurityMessage] = useState<string | null>(null)
  const [taskEditorOpen, setTaskEditorOpen] = useState(false)
  const [edits, setEdits] = useState<Record<string, TaskEditDraft>>(taskSettingsDraft?.edits ?? {})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const today = localISODate()
  const [testDate, setTestDate] = useState(() => window.sessionStorage.getItem(WITHDRAWAL_TEST_DATE_STORAGE_KEY) ?? today)
  const testToday = adminMode && testDate ? testDate : today
  const withdrawalTasks = tasks.filter((task) => task.withdrawal_syndrome)
  const negativeHabitsPin = profile?.negative_habits_pin ?? (withdrawalTasks.length > 0 ? '0000' : null)
  const negativeHabitsPinRequired = profile?.negative_habits_pin_required !== false
  const taskGroups = [
    { id: 'regular', tasks: tasks.filter((task) => !task.withdrawal_syndrome) },
    { id: 'withdrawal', tasks: withdrawalTasks },
  ].filter((group) => group.tasks.length > 0)

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

  function toggleNegativeHabitsList() {
    if (negativeHabitsListOpen) {
      setNegativeHabitsListOpen(false)
      return
    }
    if (!negativeHabitsPinRequired) {
      setNegativeHabitsListOpen(true)
      return
    }
    setNegativeHabitsListPin('')
    setNegativeHabitsListPinError(null)
    setNegativeHabitsListPinOpen(true)
  }

  function toggleNegativeHabitsSettings() {
    if (negativeHabitsSettingsOpen) {
      setNegativeHabitsSettingsOpen(false)
      setNegativeHabitsChangePinOpen(false)
      setNegativeHabitsEnablePinOpen(false)
      setCurrentNegativeHabitPin('')
      setReplacementNegativeHabitPin('')
      setNegativeHabitsEnablePin('')
      setNegativeHabitsEnablePinError(null)
      setNegativeHabitsSecurityError(null)
      setNegativeHabitsSecurityMessage(null)
      return
    }
    if (!negativeHabitsPinRequired) {
      setNegativeHabitsSettingsOpen(true)
      return
    }
    setNegativeHabitsSettingsPin('')
    setNegativeHabitsSettingsPinError(null)
    setNegativeHabitsSettingsPinOpen(true)
  }

  function unlockNegativeHabitsList() {
    if (negativeHabitsListPin !== negativeHabitsPin) {
      setNegativeHabitsListPinError('Неверный PIN')
      return
    }
    setNegativeHabitsListPinOpen(false)
    setNegativeHabitsListPin('')
    setNegativeHabitsListPinError(null)
    setNegativeHabitsListOpen(true)
  }

  function unlockNegativeHabitsSettings() {
    if (negativeHabitsSettingsPin !== negativeHabitsPin) {
      setNegativeHabitsSettingsPinError('Неверный PIN')
      return
    }
    setNegativeHabitsSettingsPinOpen(false)
    setNegativeHabitsSettingsPin('')
    setNegativeHabitsSettingsPinError(null)
    setNegativeHabitsSettingsOpen(true)
  }

  async function updateNegativeHabitsPinRequired(required: boolean) {
    if (required && !negativeHabitsPinRequired) {
      setNegativeHabitsChangePinOpen(false)
      setCurrentNegativeHabitPin('')
      setReplacementNegativeHabitPin('')
      setNegativeHabitsEnablePin('')
      setNegativeHabitsEnablePinError(null)
      setNegativeHabitsEnablePinOpen(true)
      setNegativeHabitsSecurityError(null)
      setNegativeHabitsSecurityMessage(null)
      return
    }

    setNegativeHabitsSecurityBusy(true)
    setNegativeHabitsSecurityError(null)
    setNegativeHabitsSecurityMessage(null)
    try {
      await saveNegativeHabitsSecurity({ requirePin: required })
      setNegativeHabitsChangePinOpen(false)
      setCurrentNegativeHabitPin('')
      setReplacementNegativeHabitPin('')
      setNegativeHabitsEnablePinOpen(false)
      setNegativeHabitsEnablePin('')
      setNegativeHabitsSecurityMessage(required ? 'Защита PIN включена' : 'Защита PIN отключена')
    } catch (securityError) {
      setNegativeHabitsSecurityError(
        securityError instanceof Error ? securityError.message : 'Не удалось сохранить настройку PIN',
      )
    } finally {
      setNegativeHabitsSecurityBusy(false)
    }
  }

  async function confirmNegativeHabitsPinRequired() {
    if (negativeHabitsEnablePin !== negativeHabitsPin) {
      setNegativeHabitsEnablePinError('Неверный PIN')
      return
    }

    setNegativeHabitsSecurityBusy(true)
    setNegativeHabitsEnablePinError(null)
    setNegativeHabitsSecurityError(null)
    setNegativeHabitsSecurityMessage(null)
    try {
      await saveNegativeHabitsSecurity({ requirePin: true })
      setNegativeHabitsEnablePinOpen(false)
      setNegativeHabitsEnablePin('')
      setNegativeHabitsSecurityMessage('Защита PIN включена')
    } catch (securityError) {
      setNegativeHabitsEnablePinError(
        securityError instanceof Error ? securityError.message : 'Не удалось включить защиту PIN',
      )
    } finally {
      setNegativeHabitsSecurityBusy(false)
    }
  }

  async function changeNegativeHabitsPin() {
    if (!negativeHabitsPinRequired && currentNegativeHabitPin !== negativeHabitsPin) {
      setNegativeHabitsSecurityError('Неверный действующий PIN')
      return
    }
    if (!/^\d{4}$/.test(replacementNegativeHabitPin)) {
      setNegativeHabitsSecurityError('PIN должен состоять из четырёх цифр')
      return
    }
    setNegativeHabitsSecurityBusy(true)
    setNegativeHabitsSecurityError(null)
    setNegativeHabitsSecurityMessage(null)
    try {
      await saveNegativeHabitsSecurity({ pin: replacementNegativeHabitPin })
      setNegativeHabitsChangePinOpen(false)
      setCurrentNegativeHabitPin('')
      setReplacementNegativeHabitPin('')
      setNegativeHabitsSecurityMessage('PIN изменён')
    } catch (securityError) {
      setNegativeHabitsSecurityError(
        securityError instanceof Error ? securityError.message : 'Не удалось изменить PIN',
      )
    } finally {
      setNegativeHabitsSecurityBusy(false)
    }
  }

  async function onAdd() {
    const title = newTitle.trim()
    const days = Number(newDays)
    if (!title) {
      setError('Введите название задачи')
      return
    }
    if (!newWithdrawalSyndrome && (!Number.isInteger(days) || days < 1)) {
      setError('Количество дней шкалы должно быть целым числом от 1')
      return
    }
    if (newWithdrawalSyndrome && !negativeHabitsPin && !/^\d{4}$/.test(newNegativeHabitPin)) {
      setError('Создайте PIN из четырёх цифр для негативных привычек')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (newWithdrawalSyndrome && !negativeHabitsPin) {
        await saveNegativeHabitsSecurity({ pin: newNegativeHabitPin, requirePin: true })
      }
      await addTask(title, days, newWithdrawalSyndrome)
      setNewTitle('')
      setNewDays('21')
      setNewWithdrawalSyndrome(false)
      setNewNegativeHabitPin('')
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
              {taskGroups.map((group) => (
                <li key={group.id} className={`task-group${group.id === 'withdrawal' ? ' negative-habits-group' : ''}`}>
                  {group.id === 'withdrawal' && (
                    <button
                      type="button"
                      className="ghost compact negative-habits-toggle"
                      aria-expanded={negativeHabitsListOpen}
                      aria-controls="negative-habits-task-list"
                      onClick={toggleNegativeHabitsList}
                    >
                      <span>Негативные привычки/зависимости</span>
                      <span aria-hidden="true">{negativeHabitsListOpen ? '⌃' : '⌄'}</span>
                    </button>
                  )}
                  {group.id === 'withdrawal' && negativeHabitsListPinOpen && (
                    <NegativeHabitsPinForm
                      id="negative-habits-list-pin"
                      value={negativeHabitsListPin}
                      error={negativeHabitsListPinError}
                      onChange={(value) => {
                        setNegativeHabitsListPin(value)
                        setNegativeHabitsListPinError(null)
                      }}
                      onSubmit={unlockNegativeHabitsList}
                      onCancel={() => {
                        setNegativeHabitsListPinOpen(false)
                        setNegativeHabitsListPin('')
                        setNegativeHabitsListPinError(null)
                      }}
                    />
                  )}
                  {(group.id !== 'withdrawal' || negativeHabitsListOpen) && (
                  <ul
                    id={group.id === 'withdrawal' ? 'negative-habits-task-list' : undefined}
                    className="task-group-list"
                  >
                  {group.tasks.map((task) => {
              const withdrawalPhase = getWithdrawalPhase(
                task.withdrawal_syndrome,
                task.withdrawal_started_on,
                task.withdrawal_restart_on,
                testToday,
              )
              const doneToday = completions.some(
                (c) => c.task_id === task.id && c.completed_on === today,
              )
              const actualTotalDays = getRegularTaskProgressDays(task, completions, today, profile?.time_zone)
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
                    <div className="task-title-line">
                      <strong>{task.title}</strong>
                      {isBibleReadingTaskTitle(task.title) && onContinueBibleReading && (
                        <button
                          type="button"
                          className="bible-continue-button"
                          onClick={onContinueBibleReading}
                        >
                          Продолжить чтение
                        </button>
                      )}
                    </div>
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
                  )}
                </li>
              ))}
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
          <div className={`task-editor-add${newWithdrawalSyndrome ? ' withdrawal-task-editor-add' : ''}`}>
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
                  onChange={(event) => {
                    setNewWithdrawalSyndrome(event.target.checked)
                    if (!event.target.checked) setNewNegativeHabitPin('')
                  }}
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
            {newWithdrawalSyndrome && !negativeHabitsPin && (
              <label className="negative-habits-create-pin">
                Создайте четырёхзначный пин
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={newNegativeHabitPin}
                  onChange={(event) => {
                    setNewNegativeHabitPin(normalizePin(event.target.value))
                    setError(null)
                  }}
                  placeholder="0000"
                  aria-label="PIN для негативных привычек"
                />
              </label>
            )}
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
            onClick={() => setTaskEditorOpen((open) => {
              if (open) {
                setNegativeHabitsSettingsOpen(false)
                setNegativeHabitsSettingsPinOpen(false)
                setNegativeHabitsSettingsPin('')
                setNegativeHabitsSettingsPinError(null)
              }
              return !open
            })}
          >
            {taskEditorOpen ? 'Скрыть редактирование' : 'Редактировать задачи/привычки'}
          </button>

          {taskEditorOpen && (
            <div id="task-settings-list" className="task-settings-editor">
              {tasks.some((task) => task.withdrawal_syndrome) && (
                <button
                  type="button"
                  className="ghost compact negative-habits-toggle negative-habits-settings-toggle"
                  aria-expanded={negativeHabitsSettingsOpen}
                  aria-controls="negative-habits-settings-list"
                  onClick={toggleNegativeHabitsSettings}
                >
                  <span>Негативные привычки/зависимости</span>
                  <span aria-hidden="true">{negativeHabitsSettingsOpen ? '⌃' : '⌄'}</span>
                </button>
              )}
              {negativeHabitsSettingsPinOpen && (
                <NegativeHabitsPinForm
                  id="negative-habits-settings-pin"
                  value={negativeHabitsSettingsPin}
                  error={negativeHabitsSettingsPinError}
                  onChange={(value) => {
                    setNegativeHabitsSettingsPin(value)
                    setNegativeHabitsSettingsPinError(null)
                  }}
                  onSubmit={unlockNegativeHabitsSettings}
                  onCancel={() => {
                    setNegativeHabitsSettingsPinOpen(false)
                    setNegativeHabitsSettingsPin('')
                    setNegativeHabitsSettingsPinError(null)
                  }}
                />
              )}
              {negativeHabitsSettingsOpen && (
                <div className="negative-habits-security-settings">
                  <label className="toggle negative-habits-pin-required">
                    <input
                      type="checkbox"
                      checked={negativeHabitsPinRequired}
                      disabled={negativeHabitsSecurityBusy}
                      onChange={(event) => void updateNegativeHabitsPinRequired(event.target.checked)}
                    />
                    <span>Требовать пин для раскрытия поля</span>
                  </label>
                  {negativeHabitsEnablePinOpen && (
                    <NegativeHabitsPinForm
                      id="negative-habits-enable-pin"
                      value={negativeHabitsEnablePin}
                      error={negativeHabitsEnablePinError}
                      label="Введите действующий PIN"
                      submitLabel="Включить защиту"
                      disabled={negativeHabitsSecurityBusy}
                      onChange={(value) => {
                        setNegativeHabitsEnablePin(value)
                        setNegativeHabitsEnablePinError(null)
                      }}
                      onSubmit={() => void confirmNegativeHabitsPinRequired()}
                      onCancel={() => {
                        setNegativeHabitsEnablePinOpen(false)
                        setNegativeHabitsEnablePin('')
                        setNegativeHabitsEnablePinError(null)
                      }}
                    />
                  )}
                  <button
                    type="button"
                    className="ghost compact negative-habits-change-pin-button"
                    disabled={negativeHabitsSecurityBusy}
                    onClick={() => {
                      setNegativeHabitsEnablePinOpen(false)
                      setNegativeHabitsEnablePin('')
                      setNegativeHabitsEnablePinError(null)
                      setNegativeHabitsChangePinOpen((open) => !open)
                      setCurrentNegativeHabitPin('')
                      setReplacementNegativeHabitPin('')
                      setNegativeHabitsSecurityError(null)
                      setNegativeHabitsSecurityMessage(null)
                    }}
                  >
                    Сменить пин
                  </button>
                  {negativeHabitsChangePinOpen && (
                    <form
                      className="negative-habits-change-pin-form"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void changeNegativeHabitsPin()
                      }}
                    >
                      {!negativeHabitsPinRequired && (
                        <label>
                          Действующий пин
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="current-password"
                            pattern="[0-9]{4}"
                            maxLength={4}
                            value={currentNegativeHabitPin}
                            disabled={negativeHabitsSecurityBusy}
                            onChange={(event) => {
                              setCurrentNegativeHabitPin(normalizePin(event.target.value))
                              setNegativeHabitsSecurityError(null)
                              setNegativeHabitsSecurityMessage(null)
                            }}
                            autoFocus
                          />
                        </label>
                      )}
                      <label>
                        Новый пин
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="new-password"
                          pattern="[0-9]{4}"
                          maxLength={4}
                          value={replacementNegativeHabitPin}
                          disabled={negativeHabitsSecurityBusy}
                          onChange={(event) => {
                            setReplacementNegativeHabitPin(normalizePin(event.target.value))
                            setNegativeHabitsSecurityError(null)
                            setNegativeHabitsSecurityMessage(null)
                          }}
                          autoFocus={negativeHabitsPinRequired}
                        />
                      </label>
                      <div className="negative-habits-change-pin-actions">
                        <button
                          type="submit"
                          className="primary compact"
                          disabled={
                            negativeHabitsSecurityBusy
                            || replacementNegativeHabitPin.length !== 4
                            || (!negativeHabitsPinRequired && currentNegativeHabitPin.length !== 4)
                          }
                        >
                          Сохранить пин
                        </button>
                        <button
                          type="button"
                          className="ghost compact"
                          disabled={negativeHabitsSecurityBusy}
                          onClick={() => {
                            setNegativeHabitsChangePinOpen(false)
                            setCurrentNegativeHabitPin('')
                            setReplacementNegativeHabitPin('')
                            setNegativeHabitsSecurityError(null)
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
                  )}
                  {negativeHabitsSecurityError && <p className="banner error">{negativeHabitsSecurityError}</p>}
                  {negativeHabitsSecurityMessage && <p className="hint negative-habits-security-message">{negativeHabitsSecurityMessage}</p>}
                </div>
              )}
              <ul id="negative-habits-settings-list" className="task-settings-list">
                {tasks.filter((task) => !task.withdrawal_syndrome || negativeHabitsSettingsOpen).map((task) => {
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
            </div>
          )}
          {error && <p className="banner error">{error}</p>}
        </div>
      )}
    </section>
  )
}

function NegativeHabitsPinForm({
  id,
  value,
  error,
  label = 'Введите четырёхзначный PIN',
  submitLabel = 'Открыть',
  disabled = false,
  onChange,
  onSubmit,
  onCancel,
}: {
  id: string
  value: string
  error: string | null
  label?: string
  submitLabel?: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const errorId = `${id}-error`

  return (
    <form
      id={id}
      className="negative-habits-pin-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label>
        {label}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="[0-9]{4}"
          maxLength={4}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(normalizePin(event.target.value))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoFocus
        />
      </label>
      <div className="negative-habits-pin-actions">
        <button type="submit" className="primary compact" disabled={disabled || value.length !== 4}>{submitLabel}</button>
        <button type="button" className="ghost compact" disabled={disabled} onClick={onCancel}>Отмена</button>
      </div>
      {error && <p id={errorId} className="negative-habits-pin-error">{error}</p>}
    </form>
  )
}

function normalizePin(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}

function getVirtualCompletionDays(createdAt: string, testDate: string): number {
  const createdOn = createdAt.slice(0, 10)
  if (testDate < createdOn) return 0
  return daysInclusive(parseISODate(createdOn), parseISODate(testDate))
}
