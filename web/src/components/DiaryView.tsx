import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { localISODate, parseISODate } from '../lib/dates'

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
  const { foodHistoryLogs, weightLogs } = useData()
  const datesWithRecords = useMemo(
    () => new Set([...foodHistoryLogs, ...weightLogs].map((record) => record.logged_on)),
    [foodHistoryLogs, weightLogs],
  )
  const latestDate = [...foodHistoryLogs, ...weightLogs].reduce<string | null>(
    (latest, record) => (!latest || record.logged_on > latest ? record.logged_on : latest),
    null,
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null)
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
  const totalCalories = selectedLogs.reduce(
    (sum, food) => sum + (food.weight_grams / 100) * food.calories_per_100g,
    0,
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
            const classes = [
              'calendar-day',
              datesWithRecords.has(iso) ? 'has-food' : '',
              activeSelectedDate === iso ? 'selected' : '',
              today === iso ? 'today' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button key={iso} type="button" className={classes} onClick={() => selectDay(day)}>
                {day}
              </button>
            )
          })}
        </div>
        <p className="calendar-hint">Зелёные дни содержат записи о питании или весе.</p>
      </div>

      <div className="food-list diary-food-list">
        <div className="diary-list-head">
          <div>
            <h2>{selectedLabel}</h2>
            <p>
              {selectedLogs.length ? `Всего: ${totalCalories.toFixed(0)} ккал` : 'Продукты не добавлялись'}
              {selectedWeight ? ` · Вес: ${formatWeight(selectedWeight.value)} кг` : ''}
            </p>
          </div>
        </div>
        {!selectedLogs.length ? (
          <p className="empty">В этот день продукты не добавлялись.</p>
        ) : (
          <ul>
            {selectedLogs.map((food) => {
              const consumed = (food.weight_grams / 100) * food.calories_per_100g
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
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function formatWeight(value: number) {
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}
