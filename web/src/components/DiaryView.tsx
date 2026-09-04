import { useMemo, useState } from 'react'
import { useData } from '../hooks/useData'
import { localISODate, parseISODate } from '../lib/dates'
import { getSunsetTime } from '../lib/sunset'

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
  const { foodHistoryLogs, weightLogs, scheduledExercises, profile } = useData()
  const datesWithRecords = useMemo(
    () => new Set([...foodHistoryLogs, ...weightLogs].map((record) => record.logged_on)),
    [foodHistoryLogs, weightLogs],
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
  const activeSelectedDate = selectedDate ?? latestDate
  const activeMonth = visibleMonth ?? (() => {
    const date = latestDate ? parseISODate(latestDate) : new Date()
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
  const today = localISODate()

  const previousMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))
  }

  const selectDay = (day: number) => {
    const date = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day)
    setSelectedDate(localISODate(date))
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
            const sunsetTime = profile?.shabbat_enabled && isFriday && profile.time_zone && profile.city_latitude !== null && profile.city_longitude !== null
              ? getSunsetTime(iso, profile.city_latitude, profile.city_longitude, profile.time_zone)
              : null
            const classes = [
              'calendar-day',
              datesWithRecords.has(iso) ? 'has-food' : '',
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
        <p className="calendar-hint">Зелёные дни содержат записи о питании или весе, жёлтая рамка — запланированные тренировки.</p>
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
                          <div className="food-name">{food.product_name}</div>
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
                      </li>
                    )
                  })}
                </ul>
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
              <button
                type="button"
                className="primary compact"
                onClick={() => setShowExercises(!showExercises)}
                aria-expanded={showExercises}
              >
                {showExercises ? 'Скрыть упражнения' : 'Выполненные упражнения'}
              </button>
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
