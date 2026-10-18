import { useEffect, useMemo, useState } from 'react'
import type { ScheduledExercise } from '../lib/types'

type ExerciseStatisticsProps = {
  exercises: ScheduledExercise[]
  from: string
  to: string
  periodLabel: string
  onClose: () => void
}

type NumericField = 'weight_kg' | 'repetitions' | 'sets'

const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

export function ExerciseStatistics({ exercises, from, to, periodLabel, onClose }: ExerciseStatisticsProps) {
  const [allTimeEnabled, setAllTimeEnabled] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)
  const selectedPeriod = useMemo(() => {
    if (monthOffset === 0) return { from, to, label: periodLabel }

    const [year, month] = from.split('-').map(Number)
    const selectedMonth = new Date(year, month - 1 + monthOffset, 1)
    const selectedYear = selectedMonth.getFullYear()
    const selectedMonthIndex = selectedMonth.getMonth()
    const monthNumber = String(selectedMonthIndex + 1).padStart(2, '0')
    const lastDay = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate()

    return {
      from: `${selectedYear}-${monthNumber}-01`,
      to: `${selectedYear}-${monthNumber}-${String(lastDay).padStart(2, '0')}`,
      label: `${MONTHS[selectedMonthIndex]} ${selectedYear}`,
    }
  }, [from, monthOffset, periodLabel, to])
  const statistics = useMemo(() => {
    const completed = exercises.filter(
      (exercise) => exercise.completed && (
        allTimeEnabled || (
          exercise.planned_on >= selectedPeriod.from
          && exercise.planned_on <= selectedPeriod.to
        )
      ),
    )
    const groups = new Map<string, ScheduledExercise[]>()

    for (const exercise of completed) {
      const key = exercise.exercise_name.trim().toLocaleLowerCase('ru-RU')
      groups.set(key, [...(groups.get(key) ?? []), exercise])
    }

    return [...groups.values()]
      .map((items) => ({
        name: items[0].exercise_name,
        category: items[0].category,
        exerciseType: items[0].exercise_type,
        count: items.length,
        averageWeight: averageNumericField(items, 'weight_kg'),
        averageRepetitions: averageNumericField(items, 'repetitions'),
        averageSets: averageNumericField(items, 'sets'),
        averageRestSeconds: averageRestDuration(items),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru-RU'))
  }, [allTimeEnabled, exercises, selectedPeriod])

  const activePeriodLabel = allTimeEnabled ? 'за всё время' : selectedPeriod.label

  const changeMonth = (direction: -1 | 1) => {
    setAllTimeEnabled(false)
    setMonthOffset((offset) => offset + direction)
  }

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section
        className="modal-content exercise-statistics exercise-statistics-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Статистика тренировок: ${activePeriodLabel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="exercise-statistics-heading">
          <h3>Статистика выполненных упражнений (средние значения)</h3>
          <div className="exercise-statistics-period">
            <button
              type="button"
              className="calendar-nav"
              aria-label="Показать предыдущий месяц"
              onClick={() => changeMonth(-1)}
            >
              ←
            </button>
            <span>{activePeriodLabel}</span>
            <button
              type="button"
              className="calendar-nav"
              aria-label="Показать следующий месяц"
              onClick={() => changeMonth(1)}
            >
              →
            </button>
            <button
              type="button"
              className={`chart-filter-button${allTimeEnabled ? ' active' : ''}`}
              aria-pressed={allTimeEnabled}
              onClick={() => setAllTimeEnabled((enabled) => !enabled)}
            >
              all
            </button>
            <button
              type="button"
              className="icon-close"
              aria-label="Закрыть статистику тренировок"
              onClick={onClose}
              autoFocus
            >
              ×
            </button>
          </div>
        </div>
        {statistics.length === 0 ? (
          <p className="empty">За этот период нет выполненных упражнений.</p>
        ) : (
          <div className="exercise-statistics-table-wrap">
            <table className="exercise-statistics-table">
            <thead>
              <tr>
                <th>Упражнение</th>
                <th>Выполнено</th>
                <th>Группа мышц</th>
                <th>Вес снаряда</th>
                <th>Повторения</th>
                <th>Подходы</th>
                <th>Время отдыха</th>
              </tr>
            </thead>
            <tbody>
              {statistics.map((stat) => (
                <tr key={`${stat.category}:${stat.exerciseType}:${stat.name}`}>
                  <th scope="row">{stat.name}</th>
                  <td>{stat.count}</td>
                  <td>{stat.category}</td>
                  <td>{stat.averageWeight !== null ? `${formatAverage(stat.averageWeight)} кг` : '—'}</td>
                  <td>{stat.averageRepetitions !== null ? formatAverage(stat.averageRepetitions) : '—'}</td>
                  <td>{stat.averageSets !== null ? formatAverage(stat.averageSets) : '—'}</td>
                  <td>{stat.averageRestSeconds !== null ? formatDuration(stat.averageRestSeconds) : '—'}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function averageNumericField(exercises: ScheduledExercise[], field: NumericField) {
  const values = exercises
    .map((exercise) => exercise[field])
    .filter((value): value is number => value !== null && Number.isFinite(value))
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function averageRestDuration(exercises: ScheduledExercise[]) {
  const values = exercises
    .map((exercise) => parseDuration(exercise.rest_duration))
    .filter((value): value is number => value !== null)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function parseDuration(value: string | null) {
  if (!value) return null
  const [minutes, seconds] = value.split(':').map(Number)
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return minutes * 60 + seconds
}

function formatDuration(value: number) {
  const rounded = Math.round(value)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatAverage(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}
