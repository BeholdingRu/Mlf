import { useMemo, useState } from 'react'
import { useData } from '../hooks/useData'
import {
  dateTimeInputInTimeZone,
  getAdminTestTime,
  getSavedAdminTestDateTime,
  isAdminTestTimeRunning,
  saveAdminTestDateTime,
  startAdminTestTime,
} from '../lib/admin-test-time'
import { localISODate, parseISODate } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'
import { getSunsetTime } from '../lib/sunset'
import { getRegularTaskProgress } from '../lib/task-progress'
import { ExerciseStatistics } from './ExerciseStatistics'

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function DiaryView() {
  const {
    adminMode,
    tasks,
    completions,
    foodHistoryLogs,
    weightLogs,
    scheduledExercises,
    savedProducts,
    profile,
    logFoodOnDate,
    updateFoodLogProductName,
    deleteFoodLog,
  } = useData()
  const actualToday = localISODate()
  const [testDateTime, setTestDateTime] = useState(
    () => getSavedAdminTestDateTime() || dateTimeInputInTimeZone(new Date(), profile?.time_zone),
  )
  const [testTimeRunning, setTestTimeRunning] = useState(isAdminTestTimeRunning)
  const datesWithRecords = useMemo(
    () => new Set([...foodHistoryLogs, ...weightLogs].map((record) => record.logged_on)),
    [foodHistoryLogs, weightLogs],
  )
  const datesWithMissedTasks = useMemo(
    () => new Set(
      tasks
        .filter(isNutritionTask)
        .flatMap((task) => getRegularTaskProgress(task, completions, actualToday, profile?.time_zone).missedDates),
    ),
    [actualToday, completions, profile?.time_zone, tasks],
  )
  const datesWithTraining = useMemo(
    () => new Set(scheduledExercises.map((exercise) => exercise.planned_on)),
    [scheduledExercises],
  )
  const latestDate = [...foodHistoryLogs, ...weightLogs].reduce<string | null>(
    (latest, record) => (!latest || record.logged_on > latest ? record.logged_on : latest),
    null,
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null)
  const [showProducts, setShowProducts] = useState(false)
  const [showExercises, setShowExercises] = useState(false)
  const [showTrainingStatistics, setShowTrainingStatistics] = useState(false)
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null)
  const [editingFoodName, setEditingFoodName] = useState('')
  const [foodNameEditBusy, setFoodNameEditBusy] = useState(false)
  const [foodNameEditError, setFoodNameEditError] = useState<string | null>(null)
  const [deletingFoodId, setDeletingFoodId] = useState<string | null>(null)
  const [deleteFoodError, setDeleteFoodError] = useState<string | null>(null)
  const [adminFoodFormOpen, setAdminFoodFormOpen] = useState(false)
  const [adminSavedProductId, setAdminSavedProductId] = useState('')
  const [adminFoodName, setAdminFoodName] = useState('')
  const [adminFoodWeight, setAdminFoodWeight] = useState('')
  const [adminFoodCalories, setAdminFoodCalories] = useState('')
  const [adminFoodProteins, setAdminFoodProteins] = useState('')
  const [adminFoodFats, setAdminFoodFats] = useState('')
  const [adminFoodCarbohydrates, setAdminFoodCarbohydrates] = useState('')
  const [adminFoodBusy, setAdminFoodBusy] = useState(false)
  const [adminFoodError, setAdminFoodError] = useState<string | null>(null)
  const testDate = testDateTime.slice(0, 10)
  const activeSelectedDate = selectedDate ?? (adminMode && testDate ? testDate : latestDate)
  const activeMonth = visibleMonth ?? (() => {
    const initialDate = adminMode && testDate ? testDate : latestDate
    const date = initialDate ? parseISODate(initialDate) : new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })()

  const selectedLogs = activeSelectedDate
    ? foodHistoryLogs.filter((food) => food.logged_on === activeSelectedDate)
    : []
  const selectedWeight = activeSelectedDate
    ? weightLogs.find((weight) => weight.logged_on === activeSelectedDate) ?? null
    : null
  const plannedExercises = activeSelectedDate
    ? scheduledExercises
      .filter((exercise) => exercise.planned_on === activeSelectedDate)
      .sort((a, b) => a.sort_order - b.sort_order)
    : []
  const completedExercises = plannedExercises.filter((exercise) => exercise.completed)
  const totalWorkedWeight = completedExercises.reduce(
    (total, exercise) => total + (getWorkedWeight(exercise) ?? 0),
    0,
  )
  const totalCalories = selectedLogs.reduce(
    (sum, food) => sum + (food.weight_grams / 100) * food.calories_per_100g,
    0,
  )
  const totalNutrition = selectedLogs.reduce(
    (totals, food) => {
      const multiplier = food.weight_grams / 100
      return {
        proteins: totals.proteins + multiplier * food.proteins_per_100g,
        fats: totals.fats + multiplier * food.fats_per_100g,
        carbohydrates: totals.carbohydrates + multiplier * food.carbohydrates_per_100g,
      }
    },
    { proteins: 0, fats: 0, carbohydrates: 0 },
  )
  const firstWeekday = (activeMonth.getDay() + 6) % 7
  const daysInMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate()
  const emptyDays = Array.from({ length: firstWeekday })
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => index + 1)
  const statisticsMonthStart = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1))
  const statisticsMonthEnd = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), daysInMonth))
  const today = adminMode && testDate ? testDate : localISODate()

  const previousMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))
  }

  const selectDay = (day: number) => {
    const date = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day)
    setSelectedDate(localISODate(date))
    setEditingFoodId(null)
    setFoodNameEditError(null)
    setAdminFoodFormOpen(false)
    setAdminFoodError(null)
  }

  const selectAdminSavedProduct = (productId: string) => {
    setAdminSavedProductId(productId)
    setAdminFoodError(null)
    const product = savedProducts.find((item) => item.id === productId)
    if (!product) return
    setAdminFoodName(product.name)
    setAdminFoodCalories(String(product.calories_per_100g))
    setAdminFoodProteins(String(product.proteins_per_100g))
    setAdminFoodFats(String(product.fats_per_100g))
    setAdminFoodCarbohydrates(String(product.carbohydrates_per_100g))
  }

  const resetAdminFoodForm = () => {
    setAdminSavedProductId('')
    setAdminFoodName('')
    setAdminFoodWeight('')
    setAdminFoodCalories('')
    setAdminFoodProteins('')
    setAdminFoodFats('')
    setAdminFoodCarbohydrates('')
    setAdminFoodError(null)
  }

  const addFoodToSelectedDate = async () => {
    if (!activeSelectedDate || activeSelectedDate >= actualToday || adminFoodBusy) return
    const values = [adminFoodWeight, adminFoodCalories, adminFoodProteins, adminFoodFats, adminFoodCarbohydrates]
      .map((value) => Number(value.replace(',', '.')))
    const [weight, calories, proteins, fats, carbohydrates] = values
    if (
      !adminFoodName.trim()
      || !Number.isFinite(weight) || weight <= 0
      || !Number.isFinite(calories) || calories < 0
      || !Number.isFinite(proteins) || proteins < 0
      || !Number.isFinite(fats) || fats < 0
      || !Number.isFinite(carbohydrates) || carbohydrates < 0
    ) {
      setAdminFoodError('Заполните название, вес и все значения КБЖУ')
      return
    }

    setAdminFoodBusy(true)
    setAdminFoodError(null)
    try {
      await logFoodOnDate(
        activeSelectedDate,
        adminFoodName.trim(),
        weight,
        calories,
        proteins,
        fats,
        carbohydrates,
      )
      resetAdminFoodForm()
      setAdminFoodFormOpen(false)
      setShowProducts(true)
    } catch (addError) {
      setAdminFoodError(addError instanceof Error ? addError.message : 'Не удалось добавить продукт')
    } finally {
      setAdminFoodBusy(false)
    }
  }

  const startEditingFoodName = (id: string, productName: string) => {
    setEditingFoodId(id)
    setEditingFoodName(productName)
    setFoodNameEditError(null)
  }

  const saveFoodName = async () => {
    const productName = editingFoodName.trim()
    if (!editingFoodId || !productName || foodNameEditBusy) {
      if (!productName) setFoodNameEditError('Введите название продукта')
      return
    }

    setFoodNameEditBusy(true)
    setFoodNameEditError(null)
    try {
      await updateFoodLogProductName(editingFoodId, productName)
      setEditingFoodId(null)
      setEditingFoodName('')
    } catch (editError) {
      setFoodNameEditError(editError instanceof Error ? editError.message : 'Не удалось изменить название продукта')
    } finally {
      setFoodNameEditBusy(false)
    }
  }

  const deleteFoodFromSelectedDate = async (id: string, productName: string) => {
    if (!adminMode || !activeSelectedDate || activeSelectedDate >= actualToday || deletingFoodId) return
    if (!window.confirm(`Удалить «${productName}» из продуктов за ${selectedLabel}?`)) return

    setDeletingFoodId(id)
    setDeleteFoodError(null)
    try {
      await deleteFoodLog(id)
      if (editingFoodId === id) {
        setEditingFoodId(null)
        setEditingFoodName('')
      }
    } catch (deleteError) {
      setDeleteFoodError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить продукт')
    } finally {
      setDeletingFoodId(null)
    }
  }

  const selectedLabel = activeSelectedDate
    ? parseISODate(activeSelectedDate).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Выберите день'

  return (
    <section className="diary-view">
      {adminMode && (
        <div className="withdrawal-test-date diary-test-date">
          <label htmlFor="diary-test-date-time">Тестовая дата и время</label>
          <input
            id="diary-test-date-time"
            type="datetime-local"
            value={testDateTime}
            onChange={(event) => {
              const nextValue = event.target.value
              setTestDateTime(nextValue)
              setTestTimeRunning(false)
              saveAdminTestDateTime(nextValue)
              if (nextValue) {
                const nextDate = parseISODate(nextValue.slice(0, 10))
                setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
                setSelectedDate(nextValue.slice(0, 10))
              }
            }}
          />
          <button
            type="button"
            className={`ghost compact diary-test-time-toggle${testTimeRunning ? ' active' : ''}`}
            onClick={() => {
              if (testTimeRunning) {
                const frozenTime = getAdminTestTime(profile?.time_zone)
                const frozenValue = frozenTime
                  ? dateTimeInputInTimeZone(frozenTime, profile?.time_zone)
                  : testDateTime
                setTestDateTime(frozenValue)
                saveAdminTestDateTime(frozenValue)
                setTestTimeRunning(false)
                if (frozenValue) {
                  const frozenDate = parseISODate(frozenValue.slice(0, 10))
                  setVisibleMonth(new Date(frozenDate.getFullYear(), frozenDate.getMonth(), 1))
                  setSelectedDate(frozenValue.slice(0, 10))
                }
                return
              }
              startAdminTestTime(testDateTime)
              setTestTimeRunning(true)
            }}
            disabled={!testDateTime}
            aria-pressed={testTimeRunning}
          >
            время on
          </button>
          <span className="hint">Локально симулирует дату и время без сохранения в БД.</span>
        </div>
      )}
      <div className="diary-calendar">
        <div className="calendar-head">
          <button type="button" className="calendar-nav" onClick={previousMonth} aria-label="Предыдущий месяц">
            ←
          </button>
          <h2>
            {MONTHS[activeMonth.getMonth()]} {activeMonth.getFullYear()}
          </h2>
          <button type="button" className="calendar-nav" onClick={nextMonth} aria-label="Следующий месяц">
            →
          </button>
        </div>
        <div className="calendar-grid" role="grid" aria-label="Календарь дневника">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="calendar-weekday">
              {weekday}
            </span>
          ))}
          {emptyDays.map((_, index) => (
            <span key={`empty-${index}`} />
          ))}
          {monthDays.map((day) => {
            const iso = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day))
            const isFriday = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day).getDay() === 5
            const sunsetTime = profile && isFriday && profile.time_zone && profile.city_latitude !== null && profile.city_longitude !== null
              ? getSunsetTime(iso, profile.city_latitude, profile.city_longitude, profile.time_zone)
              : null
            const classes = [
              'calendar-day',
              datesWithRecords.has(iso) ? 'has-food' : '',
              datesWithMissedTasks.has(iso) ? 'has-missed-task' : '',
              datesWithTraining.has(iso) ? 'has-training' : '',
              activeSelectedDate === iso ? 'selected' : '',
              today === iso ? 'today' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button key={iso} type="button" className={classes} onClick={() => selectDay(day)} aria-label={sunsetTime ? `${day}, заход солнца ${sunsetTime}` : undefined}>
                <span>{day}</span>
                {sunsetTime && <small className="calendar-sunset">{sunsetTime}</small>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="food-list diary-food-list">
        <div className="diary-list-head">
          <div>
            <h2>{selectedLabel}</h2>
            <p>
              {selectedWeight && (
                <span className="diary-summary-value">Вес: {formatWeight(selectedWeight.value)} кг</span>
              )}
            </p>
          </div>
        </div>
        <div className="diary-data-sections">
          <section className="diary-data-section" aria-labelledby="diary-products-heading">
            <div className="diary-section-head">
              <div>
                <h3 id="diary-products-heading">Питание</h3>
                <p>{selectedLogs.length ? `Всего: ${totalCalories.toFixed(0)} ккал` : 'Продукты не добавлялись'}</p>
              </div>
              <div className="diary-section-actions">
                {adminMode && activeSelectedDate && activeSelectedDate < actualToday && (
                  <button
                    type="button"
                    className="primary compact"
                    onClick={() => {
                      setAdminFoodFormOpen((open) => !open)
                      setAdminFoodError(null)
                    }}
                    aria-expanded={adminFoodFormOpen}
                  >
                    Добавить продукт
                  </button>
                )}
                {selectedLogs.length > 0 && (
                  <button
                    type="button"
                    className="primary compact"
                    onClick={() => setShowProducts(!showProducts)}
                    aria-expanded={showProducts}
                  >
                    {showProducts ? 'Скрыть продукты' : 'Потреблённые продукты'}
                  </button>
                )}
              </div>
            </div>
            {adminMode && adminFoodFormOpen && activeSelectedDate && activeSelectedDate < actualToday && (
              <form
                className="diary-admin-food-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void addFoodToSelectedDate()
                }}
              >
                <label className="diary-admin-food-saved">
                  Сохранённый продукт
                  <select value={adminSavedProductId} onChange={(event) => selectAdminSavedProduct(event.target.value)} disabled={adminFoodBusy}>
                    <option value="">Ввести вручную</option>
                    {[...savedProducts]
                      .sort((a, b) => a.name.localeCompare(b.name, 'ru-RU'))
                      .map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                </label>
                <label>
                  Название
                  <input value={adminFoodName} onChange={(event) => setAdminFoodName(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Вес, г
                  <input type="number" min="0.1" step="0.1" inputMode="decimal" value={adminFoodWeight} onChange={(event) => setAdminFoodWeight(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Ккал / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodCalories} onChange={(event) => setAdminFoodCalories(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Белки / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodProteins} onChange={(event) => setAdminFoodProteins(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Жиры / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodFats} onChange={(event) => setAdminFoodFats(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Углеводы / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodCarbohydrates} onChange={(event) => setAdminFoodCarbohydrates(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <div className="diary-admin-food-actions">
                  <button type="submit" className="primary compact" disabled={adminFoodBusy}>Сохранить</button>
                  <button
                    type="button"
                    className="ghost compact"
                    disabled={adminFoodBusy}
                    onClick={() => {
                      resetAdminFoodForm()
                      setAdminFoodFormOpen(false)
                    }}
                  >
                    Отмена
                  </button>
                </div>
                {adminFoodError && <p className="diary-food-name-error">{adminFoodError}</p>}
              </form>
            )}
            {showProducts && (
              <>
                <p className="diary-nutrition-total">
                  Итого за день: <strong>Б {totalNutrition.proteins.toFixed(1)} г</strong>
                  <strong>Ж {totalNutrition.fats.toFixed(1)} г</strong>
                  <strong>У {totalNutrition.carbohydrates.toFixed(1)} г</strong>
                </p>
                <ul>
                  {selectedLogs.map((food) => {
                    const consumed = (food.weight_grams / 100) * food.calories_per_100g
                    const nutritionMultiplier = food.weight_grams / 100
                    return (
                      <li key={food.id} className="food-item">
                        <div className="food-details">
                          {adminMode && editingFoodId === food.id ? (
                            <form
                              className="diary-food-name-editor"
                              onSubmit={(event) => {
                                event.preventDefault()
                                void saveFoodName()
                              }}
                            >
                              <input
                                value={editingFoodName}
                                onChange={(event) => setEditingFoodName(event.target.value)}
                                aria-label="Название потреблённого продукта"
                                autoFocus
                              />
                              <button type="submit" className="primary compact" disabled={foodNameEditBusy}>Сохранить</button>
                              <button
                                type="button"
                                className="ghost compact"
                                disabled={foodNameEditBusy}
                                onClick={() => {
                                  setEditingFoodId(null)
                                  setFoodNameEditError(null)
                                }}
                              >
                                Отмена
                              </button>
                            </form>
                          ) : (
                            <div className="diary-food-name-row">
                              <div className="food-name">{food.product_name}</div>
                              {adminMode && (
                                <button
                                  type="button"
                                  className="diary-food-edit-button"
                                  onClick={() => startEditingFoodName(food.id, food.product_name)}
                                  aria-label={`Изменить название продукта «${food.product_name}»`}
                                  title="Изменить название"
                                >
                                  ✎
                                </button>
                              )}
                            </div>
                          )}
                          {adminMode && editingFoodId === food.id && foodNameEditError && (
                            <p className="diary-food-name-error">{foodNameEditError}</p>
                          )}
                          <div className="food-info">
                            <span>{food.weight_grams}г</span>
                            <span>•</span>
                            <span>{food.calories_per_100g} ккал/100г</span>
                            <span>•</span>
                            <span className="consumed">{consumed.toFixed(0)} ккал</span>
                            <span>•</span>
                            <span>Б {(nutritionMultiplier * food.proteins_per_100g).toFixed(1)} г</span>
                            <span>•</span>
                            <span>Ж {(nutritionMultiplier * food.fats_per_100g).toFixed(1)} г</span>
                            <span>•</span>
                            <span>У {(nutritionMultiplier * food.carbohydrates_per_100g).toFixed(1)} г</span>
                          </div>
                        </div>
                        {adminMode && activeSelectedDate && activeSelectedDate < actualToday && (
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => void deleteFoodFromSelectedDate(food.id, food.product_name)}
                            disabled={deletingFoodId !== null}
                            aria-label={`Удалить продукт «${food.product_name}»`}
                            title="Удалить"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {deleteFoodError && <p className="diary-food-name-error">{deleteFoodError}</p>}
              </>
            )}
          </section>

          <section className="diary-data-section diary-exercises" aria-labelledby="diary-exercises-heading">
            <div className="diary-section-head">
              <div>
                <h3 id="diary-exercises-heading">Тренировка</h3>
                <p>
                  {completedExercises.length
                    ? `Выполнено упражнений: ${completedExercises.length}`
                    : plannedExercises.length
                      ? 'Завершённых упражнений нет'
                      : 'Не запланировано'}
                </p>
              </div>
              <div className="diary-section-actions">
                {plannedExercises.length > 0 && (
                  <button
                    type="button"
                    className="primary compact"
                    onClick={() => setShowExercises(!showExercises)}
                    aria-expanded={showExercises}
                  >
                    {showExercises ? 'Скрыть упражнения' : 'Выполненные упражнения'}
                  </button>
                )}
                <button
                  type="button"
                  className="primary compact"
                  onClick={() => setShowTrainingStatistics((open) => !open)}
                  aria-expanded={showTrainingStatistics}
                >
                  Статистика
                </button>
              </div>
            </div>
            {showExercises && (
              <>
                <p className="worked-weight">
                  Всего поднято доп. веса: <strong>{formatWeight(totalWorkedWeight)} кг</strong>
                </p>
                {completedExercises.length === 0 ? (
                  <p className="empty">В этот день нет завершённых упражнений.</p>
                ) : (
                  <ul>
                    {completedExercises.map((exercise) => (
                      <li key={exercise.id} className="food-item">
                        <div className="food-details">
                          <div className="food-name">{exercise.exercise_name}</div>
                          <div className="food-info">
                            {exercise.weight_kg !== null && <span>Вес снаряда: {formatWeight(exercise.weight_kg)} кг</span>}
                            {exercise.weight_kg !== null && <span>•</span>}
                            <span>Повторения: {exercise.repetitions ?? '—'}</span>
                            <span>•</span>
                            <span>Подходы: {exercise.sets ?? '—'}</span>
                            {getWorkedWeight(exercise) !== null && (
                              <>
                                <span>•</span>
                                <span>Отработанный вес: {formatWeight(getWorkedWeight(exercise)!)} кг</span>
                              </>
                            )}
                            {exercise.rest_timer_enabled && (
                              <>
                                <span>•</span>
                                <span>Время между подходами: {exercise.rest_duration ?? '00:00'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {showTrainingStatistics && (
              <ExerciseStatistics
                exercises={scheduledExercises}
                from={statisticsMonthStart}
                to={statisticsMonthEnd}
                periodLabel={`${MONTHS[activeMonth.getMonth()].toLocaleLowerCase('ru-RU')} ${activeMonth.getFullYear()}`}
              />
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

function formatWeight(value: number) {
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

function getWorkedWeight(exercise: { exercise_type: string; weight_kg: number | null; repetitions: number | null; sets: number | null }) {
  if (exercise.exercise_type !== 'Свободные веса / в блоке') return null
  if (exercise.weight_kg === null || exercise.repetitions === null || exercise.sets === null) return null
  return exercise.weight_kg * exercise.repetitions * exercise.sets
}
