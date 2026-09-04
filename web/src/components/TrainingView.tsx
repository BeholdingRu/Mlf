import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../hooks/useData'
import { localISODate, parseISODate } from '../lib/dates'
import type { ExerciseCategory, ExerciseType, SavedExercise, ScheduledExercise } from '../lib/types'

type TrainingSubTab = 'workouts' | 'schedule' | 'exercises'

const TRAINING_SUB_TAB_STORAGE_KEY = 'mlf:training-sub-tab'
const EXERCISE_DRAFT_STORAGE_KEY = 'mlf:exercise-draft'
const TRAINING_SUB_TABS: TrainingSubTab[] = ['workouts', 'schedule', 'exercises']

function getSavedTrainingSubTab(): TrainingSubTab {
  const savedTab = window.sessionStorage.getItem(TRAINING_SUB_TAB_STORAGE_KEY)
  return TRAINING_SUB_TABS.includes(savedTab as TrainingSubTab) ? savedTab as TrainingSubTab : 'workouts'
}

const EXERCISE_GROUPS: ExerciseCategory[] = ['Спина', 'Грудь', 'Плечи', 'Руки', 'Ноги', 'Кор']
const EXERCISE_TYPES: ExerciseType[] = ['Свободные веса / в блоке', 'Собственный вес']

type ExerciseDraft = {
  category: ExerciseCategory
  name: string
  exerciseType: ExerciseType
  restTimerEnabled: boolean
}

function getSavedExerciseDraft(): ExerciseDraft | null {
  try {
    const savedDraft = window.sessionStorage.getItem(EXERCISE_DRAFT_STORAGE_KEY)
    if (!savedDraft) return null

    const draft = JSON.parse(savedDraft) as Partial<ExerciseDraft>
    if (
      !EXERCISE_GROUPS.includes(draft.category as ExerciseCategory)
      || typeof draft.name !== 'string'
      || !EXERCISE_TYPES.includes(draft.exerciseType as ExerciseType)
      || typeof draft.restTimerEnabled !== 'boolean'
    ) {
      window.sessionStorage.removeItem(EXERCISE_DRAFT_STORAGE_KEY)
      return null
    }

    return {
      category: draft.category as ExerciseCategory,
      name: draft.name,
      exerciseType: draft.exerciseType as ExerciseType,
      restTimerEnabled: draft.restTimerEnabled,
    }
  } catch {
    window.sessionStorage.removeItem(EXERCISE_DRAFT_STORAGE_KEY)
    return null
  }
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function TrainingView() {
  const {
    savedExercises,
    scheduledExercises,
    addSavedExercise,
    updateSavedExercise,
    deleteSavedExercise,
    scheduleExercise,
    deleteScheduledExercise,
    moveScheduledExercise,
    updateScheduledExercise,
  } = useData()
  const [exerciseDraft] = useState<ExerciseDraft | null>(getSavedExerciseDraft)
  const [subTab, setSubTab] = useState<TrainingSubTab>(getSavedTrainingSubTab)
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(exerciseDraft?.category ?? null)
  const [name, setName] = useState(exerciseDraft?.name ?? '')
  const [exerciseType, setExerciseType] = useState<ExerciseType>(exerciseDraft?.exerciseType ?? EXERCISE_TYPES[0])
  const [restTimerEnabled, setRestTimerEnabled] = useState(exerciseDraft?.restTimerEnabled ?? true)
  const [persistExerciseDraft, setPersistExerciseDraft] = useState(Boolean(exerciseDraft))
  const [editingExercise, setEditingExercise] = useState<SavedExercise | null>(null)
  const [editName, setEditName] = useState('')
  const [editExerciseType, setEditExerciseType] = useState<ExerciseType>(EXERCISE_TYPES[0])
  const [editRestTimerEnabled, setEditRestTimerEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [plannedDate, setPlannedDate] = useState(() => localISODate())
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [plannedCategory, setPlannedCategory] = useState<ExerciseCategory | null>(null)

  const exercises = selectedCategory
    ? savedExercises.filter((exercise) => exercise.category === selectedCategory)
    : []
  const today = localISODate()
  const todayExercises = scheduledExercises
    .filter((exercise) => exercise.planned_on === today)
    .sort((a, b) => a.sort_order - b.sort_order)
  const plannedExercises = scheduledExercises
    .filter((exercise) => exercise.planned_on === plannedDate)
    .sort((a, b) => a.sort_order - b.sort_order)
  const exercisesForPlannedCategory = plannedCategory
    ? savedExercises.filter((exercise) => exercise.category === plannedCategory)
    : []
  const scheduledDates = useMemo(
    () => new Set(scheduledExercises.map((exercise) => exercise.planned_on)),
    [scheduledExercises],
  )
  const firstWeekday = (visibleMonth.getDay() + 6) % 7
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => index + 1)

  useEffect(() => {
    window.sessionStorage.setItem(TRAINING_SUB_TAB_STORAGE_KEY, subTab)
  }, [subTab])

  useEffect(() => {
    if (!persistExerciseDraft || !selectedCategory) {
      window.sessionStorage.removeItem(EXERCISE_DRAFT_STORAGE_KEY)
      return
    }

    const draft: ExerciseDraft = {
      category: selectedCategory,
      name,
      exerciseType,
      restTimerEnabled,
    }
    window.sessionStorage.setItem(EXERCISE_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [exerciseType, name, persistExerciseDraft, restTimerEnabled, selectedCategory])

  const selectCategory = (category: ExerciseCategory) => {
    window.sessionStorage.removeItem(EXERCISE_DRAFT_STORAGE_KEY)
    setSelectedCategory(category)
    setName('')
    setExerciseType(EXERCISE_TYPES[0])
    setRestTimerEnabled(true)
    setPersistExerciseDraft(true)
  }

  const handleAddExercise = async () => {
    if (!selectedCategory || !name.trim()) {
      alert('Введите название упражнения')
      return
    }

    setSubmitting(true)
    try {
      await addSavedExercise(name.trim(), selectedCategory, exerciseType, restTimerEnabled)
      setName('')
      setExerciseType(EXERCISE_TYPES[0])
      setRestTimerEnabled(true)
      setPersistExerciseDraft(false)
    } catch (err) {
      console.error('Error adding exercise:', err)
      alert('Не удалось сохранить упражнение. Возможно, оно уже есть в этой категории.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditClick = (exercise: SavedExercise) => {
    setEditingExercise(exercise)
    setEditName(exercise.name)
    setEditExerciseType(exercise.exercise_type)
    setEditRestTimerEnabled(exercise.rest_timer_enabled)
  }

  const handleEditCancel = () => {
    setEditingExercise(null)
    setEditName('')
    setEditExerciseType(EXERCISE_TYPES[0])
    setEditRestTimerEnabled(false)
  }

  const handleEditSave = async () => {
    if (!editingExercise || !editName.trim()) {
      alert('Введите название упражнения')
      return
    }

    setSubmitting(true)
    try {
      await updateSavedExercise(
        editingExercise.id,
        editName.trim(),
        editExerciseType,
        editRestTimerEnabled,
      )
      handleEditCancel()
    } catch (err) {
      console.error('Error updating exercise:', err)
      alert('Не удалось обновить упражнение. Возможно, оно уже есть в этой категории.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteExercise = async (exercise: SavedExercise) => {
    if (!window.confirm(`Вы уверены, что хотите удалить упражнение «${exercise.name}»?`)) return

    try {
      await deleteSavedExercise(exercise.id)
    } catch (err) {
      console.error('Error deleting exercise:', err)
      alert('Не удалось удалить упражнение')
    }
  }

  const handleScheduleExercise = async (exercise: SavedExercise) => {
    setSubmitting(true)
    try {
      await scheduleExercise(plannedDate, exercise)
    } catch (err) {
      console.error('Error scheduling exercise:', err)
      alert('Не удалось добавить упражнение в тренировку')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteScheduledExercise = async (id: string, name: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить упражнение «${name}» из тренировки?`)) return

    try {
      await deleteScheduledExercise(id)
    } catch (err) {
      console.error('Error deleting scheduled exercise:', err)
      alert('Не удалось удалить упражнение из тренировки')
    }
  }

  const handleMoveScheduledExercise = async (id: string, direction: 'up' | 'down') => {
    try {
      await moveScheduledExercise(id, direction)
    } catch (err) {
      console.error('Error moving scheduled exercise:', err)
      alert('Не удалось изменить порядок упражнений')
    }
  }

  const selectedDateLabel = parseISODate(plannedDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="calories-view">
      <nav className="calories-tabs" aria-label="Разделы тренировок">
        <button
          type="button"
          className={subTab === 'workouts' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => setSubTab('workouts')}
        >
          Тренировки
        </button>
        <button
          type="button"
          className={subTab === 'schedule' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => setSubTab('schedule')}
        >
          Запланировать тренировку
        </button>
        <button
          type="button"
          className={subTab === 'exercises' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => setSubTab('exercises')}
        >
          Упражнения
        </button>
      </nav>
      {subTab === 'workouts' && (
        <section className="today-workout food-list">
          <h2>Тренировка на сегодня</h2>
          {todayExercises.length === 0 ? (
            <p className="empty">На сегодня тренировка не запланирована</p>
          ) : (
            <ul>
              {todayExercises.map((exercise, index) => (
                <li key={exercise.id} className="food-item">
                  <div className="food-details">
                    <div className="food-name">{index + 1}. {exercise.exercise_name}</div>
                    <div className="food-info">
                      {exercise.category} · {exercise.exercise_type} · Таймер отдыха: {exercise.rest_timer_enabled ? 'включен' : 'выключен'}
                    </div>
                    <WorkoutExerciseFields
                      exercise={exercise}
                      showExecutionControls
                      onSave={async (patch) => {
                        try {
                          await updateScheduledExercise(exercise.id, patch)
                        } catch (err) {
                          console.error('Error updating workout exercise:', err)
                          alert('Не удалось сохранить параметры упражнения')
                        }
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {subTab === 'schedule' && (
        <section className="training-planner">
          <div className="diary-calendar">
            <div className="calendar-head">
              <button
                type="button"
                className="calendar-nav"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                aria-label="Предыдущий месяц"
              >
                ←
              </button>
              <h2>{MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</h2>
              <button
                type="button"
                className="calendar-nav"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                aria-label="Следующий месяц"
              >
                →
              </button>
            </div>
            <div className="calendar-grid" role="grid" aria-label="Календарь тренировок">
              {WEEKDAYS.map((weekday) => <span key={weekday} className="calendar-weekday">{weekday}</span>)}
              {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
              {monthDays.map((day) => {
                const date = localISODate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
                const classes = [
                  'calendar-day',
                  scheduledDates.has(date) ? 'has-training' : '',
                  plannedDate === date ? 'selected' : '',
                  today === date ? 'today' : '',
                ].filter(Boolean).join(' ')
                return (
                  <button key={date} type="button" className={classes} onClick={() => setPlannedDate(date)}>
                    {day}
                  </button>
                )
              })}
            </div>
            <p className="calendar-hint">Выделенные дни содержат запланированные тренировки.</p>
          </div>

          <div className="planner-content">
            <header className="planner-head">
              <h2>{selectedDateLabel}</h2>
              <p>Выберите группу мышц, затем добавьте сохранённые упражнения в план.</p>
            </header>
            <div className="exercise-groups planner-groups">
              {EXERCISE_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  className={plannedCategory === group ? 'exercise-group active' : 'exercise-group'}
                  onClick={() => setPlannedCategory(group)}
                >
                  {group}
                </button>
              ))}
            </div>
            {plannedCategory && (
              <div className="saved-exercises">
                <h3>Упражнения: {plannedCategory}</h3>
                {exercisesForPlannedCategory.length === 0 ? (
                  <p className="empty">В этой категории пока нет сохранённых упражнений</p>
                ) : (
                  <div className="saved-exercise-options">
                    {exercisesForPlannedCategory.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        className="saved-exercise-option"
                        onClick={() => handleScheduleExercise(exercise)}
                        disabled={submitting}
                      >
                        <strong>{exercise.name}</strong>
                        <span>{exercise.exercise_type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="food-list planned-exercises">
              <h3>Запланированные упражнения</h3>
              {plannedExercises.length === 0 ? (
                <p className="empty">Упражнения ещё не добавлены</p>
              ) : (
                <ul>
                  {plannedExercises.map((exercise, index) => (
                    <li key={exercise.id} className="food-item">
                      <div className="food-details">
                        <div className="food-name">{index + 1}. {exercise.exercise_name}</div>
                        <div className="food-info">
                          {exercise.category} · {exercise.exercise_type} · Таймер отдыха: {exercise.rest_timer_enabled ? 'включен' : 'выключен'}
                        </div>
                        <WorkoutExerciseFields
                          exercise={exercise}
                          onSave={async (patch) => {
                            try {
                              await updateScheduledExercise(exercise.id, patch)
                            } catch (err) {
                              console.error('Error updating planned exercise:', err)
                              alert('Не удалось сохранить параметры упражнения')
                            }
                          }}
                        />
                      </div>
                      <div className="food-actions">
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleMoveScheduledExercise(exercise.id, 'up')}
                          disabled={index === 0}
                          aria-label={`Переместить ${exercise.exercise_name} выше`}
                          title="Переместить выше"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleMoveScheduledExercise(exercise.id, 'down')}
                          disabled={index === plannedExercises.length - 1}
                          aria-label={`Переместить ${exercise.exercise_name} ниже`}
                          title="Переместить ниже"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDeleteScheduledExercise(exercise.id, exercise.exercise_name)}
                          aria-label={`Удалить ${exercise.exercise_name} из тренировки`}
                          title="Удалить из тренировки"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
      {subTab === 'exercises' && (
        <div className="exercise-groups">
          {EXERCISE_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              className={selectedCategory === group ? 'exercise-group active' : 'exercise-group'}
              onClick={() => selectCategory(group)}
            >
              {group}
            </button>
          ))}
        </div>
      )}
      {subTab === 'exercises' && selectedCategory && (
        <section className="exercise-category">
          <div className="food-form">
            <h3>{selectedCategory}</h3>
            <div className="form-group">
              <label htmlFor="exercise-name">Введите название нового упражнения</label>
              <input
                id="exercise-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="exercise-type">Тип упражнения</label>
              <select
                id="exercise-type"
                value={exerciseType}
                onChange={(event) => setExerciseType(event.target.value as ExerciseType)}
                disabled={submitting}
              >
                {EXERCISE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={restTimerEnabled}
                onChange={(event) => setRestTimerEnabled(event.target.checked)}
                disabled={submitting}
              />
              <span>Таймер отдыха между подходами</span>
            </label>
            <button type="button" className="add-button" onClick={handleAddExercise} disabled={submitting}>
              {submitting ? 'Сохранение...' : 'Сохранить упражнение'}
            </button>
          </div>

          <div className="food-list">
            <h3>Упражнения: {selectedCategory}</h3>
            {exercises.length === 0 ? (
              <p className="empty">В этой категории пока нет упражнений</p>
            ) : (
              <ul>
                {exercises.map((exercise) => (
                  <li key={exercise.id} className="food-item">
                    <div className="food-details">
                      <div className="food-name">{exercise.name}</div>
                      <div className="food-info">
                        {exercise.exercise_type} · Таймер отдыха: {exercise.rest_timer_enabled ? 'включен' : 'выключен'}
                      </div>
                    </div>
                    <div className="food-actions">
                      <button
                        type="button"
                        className="edit-button"
                        onClick={() => handleEditClick(exercise)}
                        aria-label={`Редактировать ${exercise.name}`}
                        title="Редактировать упражнение"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => handleDeleteExercise(exercise)}
                        aria-label={`Удалить ${exercise.name}`}
                        title="Удалить упражнение"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      {editingExercise && (
        <div className="modal-overlay" onClick={handleEditCancel}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h3>Редактировать упражнение</h3>
            <div className="form-group">
              <label htmlFor="edit-exercise-name">Название упражнения</label>
              <input
                id="edit-exercise-name"
                type="text"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-exercise-type">Тип упражнения</label>
              <select
                id="edit-exercise-type"
                value={editExerciseType}
                onChange={(event) => setEditExerciseType(event.target.value as ExerciseType)}
                disabled={submitting}
              >
                {EXERCISE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={editRestTimerEnabled}
                onChange={(event) => setEditRestTimerEnabled(event.target.checked)}
                disabled={submitting}
              />
              <span>Таймер отдыха между подходами</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="save-button" onClick={handleEditSave} disabled={submitting}>
                {submitting ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button type="button" className="cancel-button" onClick={handleEditCancel} disabled={submitting}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type WorkoutExerciseFieldsProps = {
  exercise: ScheduledExercise
  showExecutionControls?: boolean
  onSave: (patch: {
    weight_kg?: number | null
    repetitions?: number | null
    sets?: number | null
    rest_duration?: string | null
    parameters_locked?: boolean
    completed?: boolean
  }) => Promise<void>
}

type ExerciseExecutionState = {
  started: boolean
  setInProgress: boolean
  remainingSets: number
  restEndsAt: number | null
  completed: boolean
}

type ExerciseParametersDraft = {
  weight: string
  repetitions: string
  sets: string
  restDuration: string
}

function getExerciseExecutionStorageKey(exerciseId: string) {
  return `mlf:exercise-execution:${exerciseId}`
}

function getExerciseParametersDraftStorageKey(exerciseId: string) {
  return `mlf:exercise-parameters-draft:${exerciseId}`
}

function getSavedExerciseExecution(exerciseId: string): ExerciseExecutionState {
  const fallback: ExerciseExecutionState = {
    started: false,
    setInProgress: false,
    remainingSets: 0,
    restEndsAt: null,
    completed: false,
  }

  try {
    const rawState = window.sessionStorage.getItem(getExerciseExecutionStorageKey(exerciseId))
    if (!rawState) return fallback
    const state = JSON.parse(rawState) as Partial<ExerciseExecutionState>
    const remainingSets = state.remainingSets
    if (
      typeof state.started !== 'boolean'
      || typeof state.setInProgress !== 'boolean'
      || !Number.isInteger(remainingSets)
      || remainingSets === undefined
      || remainingSets < 0
      || (state.restEndsAt !== null && typeof state.restEndsAt !== 'number')
      || typeof state.completed !== 'boolean'
    ) return fallback

    return {
      started: state.started,
      setInProgress: state.setInProgress,
      remainingSets,
      restEndsAt: state.restEndsAt,
      completed: state.completed,
    }
  } catch {
    return fallback
  }
}

function getSavedExerciseParametersDraft(exerciseId: string): ExerciseParametersDraft | null {
  try {
    const rawDraft = window.sessionStorage.getItem(getExerciseParametersDraftStorageKey(exerciseId))
    if (!rawDraft) return null

    const draft = JSON.parse(rawDraft) as Partial<ExerciseParametersDraft>
    if (
      typeof draft.weight !== 'string'
      || typeof draft.repetitions !== 'string'
      || typeof draft.sets !== 'string'
      || typeof draft.restDuration !== 'string'
    ) {
      window.sessionStorage.removeItem(getExerciseParametersDraftStorageKey(exerciseId))
      return null
    }

    return {
      weight: draft.weight,
      repetitions: draft.repetitions,
      sets: draft.sets,
      restDuration: draft.restDuration,
    }
  } catch {
    window.sessionStorage.removeItem(getExerciseParametersDraftStorageKey(exerciseId))
    return null
  }
}

function WorkoutExerciseFields({ exercise, showExecutionControls = false, onSave }: WorkoutExerciseFieldsProps) {
  const [parametersDraft] = useState<ExerciseParametersDraft | null>(() => getSavedExerciseParametersDraft(exercise.id))
  const [editing, setEditing] = useState(Boolean(parametersDraft))
  const [weight, setWeight] = useState(parametersDraft?.weight ?? exercise.weight_kg?.toString() ?? '')
  const [repetitions, setRepetitions] = useState(parametersDraft?.repetitions ?? exercise.repetitions?.toString() ?? '')
  const [sets, setSets] = useState(parametersDraft?.sets ?? exercise.sets?.toString() ?? '')
  const [restDuration, setRestDuration] = useState(parametersDraft?.restDuration ?? formatRestDuration(exercise.rest_duration))
  const [saving, setSaving] = useState(false)
  const [execution, setExecution] = useState(() => {
    const savedExecution = getSavedExerciseExecution(exercise.id)
    return exercise.completed
      ? { ...savedExecution, started: true, remainingSets: 0, restEndsAt: null, completed: true }
      : savedExecution
  })
  const [currentTime, setCurrentTime] = useState(0)
  const onSaveRef = useRef(onSave)
  const restSeconds = execution.restEndsAt === null
    ? null
    : currentTime === 0 ? 0 : Math.max(0, Math.ceil((execution.restEndsAt - currentTime) / 1000))

  useEffect(() => {
    if (!showExecutionControls) return
    window.sessionStorage.setItem(getExerciseExecutionStorageKey(exercise.id), JSON.stringify(execution))
  }, [exercise.id, execution, showExecutionControls])

  useEffect(() => {
    const storageKey = getExerciseParametersDraftStorageKey(exercise.id)
    if (!editing || exercise.parameters_locked) {
      window.sessionStorage.removeItem(storageKey)
      return
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify({ weight, repetitions, sets, restDuration }))
  }, [editing, exercise.id, exercise.parameters_locked, repetitions, restDuration, sets, weight])

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    if (execution.restEndsAt === null) return

    const updateCountdown = () => {
      const secondsLeft = Math.ceil((execution.restEndsAt! - Date.now()) / 1000)
      if (secondsLeft <= 0) {
        playSound('/sounds/rest-finished.mp3')
        setExecution((current) => ({
          ...current,
          restEndsAt: null,
        }))
        return
      }

      if (
        (secondsLeft <= 14 && secondsLeft > 6 && secondsLeft % 2 === 0)
        || (secondsLeft <= 6)
      ) playSound('/sounds/countdown.mp3')
      setCurrentTime(Date.now())
    }

    const initialTimeout = window.setTimeout(updateCountdown, 0)
    const interval = window.setInterval(updateCountdown, 1000)

    return () => {
      window.clearTimeout(initialTimeout)
      window.clearInterval(interval)
    }
  }, [execution.remainingSets, execution.restEndsAt])

  const parseNumber = (
    rawValue: string,
    allowDecimal: boolean,
  ): number | null | undefined => {
    const value = rawValue.trim().replace(',', '.')
    if (!value) return null

    const valid = allowDecimal ? /^\d+(?:\.\d)?$/ : /^\d+$/
    const number = Number(value)
    if (!valid.test(value) || !Number.isFinite(number) || number <= 0) {
      alert(allowDecimal ? 'Введите вес числом с точностью до десятых' : 'Введите целое число больше нуля')
      return undefined
    }

    return number
  }

  const handleEdit = () => {
    if (exercise.parameters_locked) return
    setWeight(exercise.weight_kg?.toString() ?? '')
    setRepetitions(exercise.repetitions?.toString() ?? '')
    setSets(exercise.sets?.toString() ?? '')
    setRestDuration(formatRestDuration(exercise.rest_duration))
    setEditing(true)
  }

  const completeSet = (restEndsAt: number | null) => {
    setExecution((current) => {
      const remainingSets = Math.max(current.remainingSets - 1, 0)
      const completed = remainingSets === 0
      if (completed) {
        playSound('/sounds/exercise-completed.mp3')
        void onSave({ completed: true })
      }
      return {
        ...current,
        setInProgress: false,
        remainingSets,
        restEndsAt: completed ? null : restEndsAt,
        completed,
      }
    })
  }

  const handleStartExercise = async () => {
    const totalSets = exercise.sets ?? 0
    if (totalSets <= 0) {
      alert('Сначала укажите количество подходов и сохраните упражнение')
      return
    }

    setSaving(true)
    try {
      await onSave({ parameters_locked: true })
      setExecution({
        started: true,
        setInProgress: false,
        remainingSets: totalSets,
        restEndsAt: null,
        completed: false,
      })
    } catch (error) {
      console.error('Error locking workout exercise parameters:', error)
      alert('Не удалось начать упражнение')
    } finally {
      setSaving(false)
    }
  }

  const handleSetButtonClick = () => {
    if (!execution.setInProgress) {
      setExecution((current) => ({ ...current, setInProgress: true }))
      return
    }

    const totalRestSeconds = parseRestDuration(exercise.rest_duration)
    if (exercise.rest_timer_enabled && totalRestSeconds > 0) {
      const restEndsAt = Date.now() + totalRestSeconds * 1000
      setCurrentTime(Date.now())
      completeSet(restEndsAt)
      return
    }

    completeSet(null)
  }

  const handleSave = async () => {
    if (exercise.parameters_locked) return
    const weightValue = exercise.exercise_type === 'Свободные веса / в блоке'
      ? parseNumber(weight, true)
      : null
    const repetitionsValue = parseNumber(repetitions, false)
    const setsValue = parseNumber(sets, false)
    const restValue = restDuration.trim()

    if (weightValue === undefined || repetitionsValue === undefined || setsValue === undefined) return
    if (exercise.rest_timer_enabled && !/^\d{2}:[0-5]\d$/.test(restValue)) {
      alert('Введите время в формате ММ:СС')
      return
    }

    setSaving(true)
    try {
      await onSave({
        weight_kg: weightValue,
        repetitions: repetitionsValue,
        sets: setsValue,
        rest_duration: exercise.rest_timer_enabled ? restValue || null : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workout-exercise-form">
      <div className="workout-exercise-fields">
        {exercise.exercise_type === 'Свободные веса / в блоке' && (
          <label>
            Вес снаряда
            <input
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(event) => setWeight(event.currentTarget.value.replace(/[^\d,.]/g, ''))}
              placeholder="0,0"
              disabled={!editing || saving || exercise.parameters_locked}
            />
          </label>
        )}
        <label>
          Повторения
          <input
            type="text"
            inputMode="numeric"
            value={repetitions}
            onChange={(event) => setRepetitions(event.currentTarget.value.replace(/\D/g, ''))}
            placeholder="0"
            disabled={!editing || saving || exercise.parameters_locked}
          />
        </label>
        <label>
          Подходы
          <input
            type="text"
            inputMode="numeric"
            value={sets}
            onChange={(event) => setSets(event.currentTarget.value.replace(/\D/g, ''))}
            placeholder="0"
            disabled={!editing || saving || exercise.parameters_locked}
          />
        </label>
        {exercise.rest_timer_enabled && (
          <label>
            Время между подходами
            <input
              type="text"
              inputMode="numeric"
              value={restDuration}
              onKeyDown={(event) => {
                if (!editing || saving || exercise.parameters_locked) return
                const input = event.currentTarget
                const start = input.selectionStart ?? 0
                const end = input.selectionEnd ?? start

                if (/^\d$/.test(event.key)) {
                  event.preventDefault()
                  const digitIndex = start === 2 ? 3 : Math.min(start, 4)
                  const next = `${restDuration.slice(0, digitIndex)}${event.key}${restDuration.slice(digitIndex + 1)}`
                  setRestDuration(next)
                  requestAnimationFrame(() => input.setSelectionRange(Math.min(digitIndex + 1, 5), Math.min(digitIndex + 1, 5)))
                  return
                }

                if (event.key === 'Backspace' || event.key === 'Delete') {
                  event.preventDefault()
                  const digitIndex = event.key === 'Backspace'
                    ? (start <= 3 ? Math.max(start - 1, 0) : start - 1)
                    : (start === 2 ? 3 : Math.min(start, 4))
                  if (digitIndex === 2) return
                  const next = `${restDuration.slice(0, digitIndex)}0${restDuration.slice(digitIndex + 1)}`
                  setRestDuration(next)
                  requestAnimationFrame(() => input.setSelectionRange(digitIndex, digitIndex))
                  return
                }

                if (event.key === ':') event.preventDefault()
                if (end > start && ['Backspace', 'Delete'].includes(event.key)) event.preventDefault()
              }}
              onChange={() => undefined}
              maxLength={5}
              disabled={!editing || saving || exercise.parameters_locked}
            />
          </label>
        )}
      </div>
      <div className="workout-exercise-actions">
        {editing ? (
          <button type="button" className="primary compact" onClick={() => void handleSave()} disabled={saving || exercise.parameters_locked}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        ) : (
          <button type="button" className="ghost compact" onClick={handleEdit} disabled={exercise.parameters_locked}>
            Редактировать
          </button>
        )}
      </div>
      {showExecutionControls && (
        <div className="exercise-execution">
          <button
            type="button"
            className={execution.completed ? 'primary compact exercise-completed' : 'primary compact'}
            onClick={() => void handleStartExercise()}
            disabled={execution.started || exercise.parameters_locked || saving}
          >
            {execution.completed ? 'Упражнение выполнено' : exercise.parameters_locked ? 'Упражнение начато' : 'Начать упражнение'}
          </button>
          {execution.completed && getWorkedWeight(exercise) !== null && (
            <p className="worked-weight">
              Отработанный вес: <strong>{formatWeight(getWorkedWeight(exercise)!)} кг</strong>
            </p>
          )}
          {execution.started && !execution.completed && (
            <div className="exercise-set-status">
              <button
                type="button"
                className={execution.setInProgress ? 'danger compact' : 'primary compact'}
                onClick={handleSetButtonClick}
                disabled={restSeconds !== null || execution.completed}
              >
                {execution.setInProgress ? 'Закончить подход' : 'Начать подход'}
              </button>
              <p className="remaining-sets">
                Осталось подходов: <strong>{execution.remainingSets}</strong>
              </p>
              {restSeconds !== null && (
                <p className="rest-countdown" aria-live="polite">
                  Отдых: {formatCountdown(restSeconds)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatRestDuration(value: string | null) {
  const [minutes = '', seconds = ''] = (value ?? '').split(':')
  const normalizedMinutes = minutes.replace(/\D/g, '').slice(0, 2).padStart(2, '0')
  const normalizedSeconds = seconds.replace(/\D/g, '').slice(0, 2).padEnd(2, '0')
  return `${normalizedMinutes}:${normalizedSeconds}`
}

function parseRestDuration(value: string | null) {
  const [minutes = '0', seconds = '0'] = (value ?? '').split(':')
  const totalSeconds = Number(minutes) * 60 + Number(seconds)
  return Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function getWorkedWeight(exercise: ScheduledExercise) {
  if (exercise.exercise_type !== 'Свободные веса / в блоке') return null
  if (exercise.weight_kg === null || exercise.repetitions === null || exercise.sets === null) return null
  return exercise.weight_kg * exercise.repetitions * exercise.sets
}

function formatWeight(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

function playSound(source: string) {
  const audio = new Audio(source)
  audio.play().catch(() => undefined)
}
