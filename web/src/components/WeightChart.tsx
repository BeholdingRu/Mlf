import { daysInclusive, parseISODate } from '../lib/dates'
import type { WeightLog } from '../lib/types'

type WeightChartProps = {
  logs: WeightLog[]
  startDate: string | null
  startWeight: number | null
  desiredWeight: number | null
}

export function WeightChart({ logs, startDate, startWeight, desiredWeight }: WeightChartProps) {
  if (!startDate) {
    return <div className="weight-chart-empty">Нет данных о весе</div>
  }

  const sorted = [...logs].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
  const firstDate = parseISODate(startDate)
  const lastDate = sorted.length > 0 ? parseISODate(sorted[sorted.length - 1].logged_on) : firstDate
  const totalDays = daysInclusive(firstDate, lastDate)

  // Используем стартовый вес как начальное значение
  const allValues = startWeight != null ? [startWeight, ...sorted.map((l) => l.value)] : sorted.map((l) => l.value)
  
  if (allValues.length === 0) {
    return <div className="weight-chart-empty">Нет данных о весе</div>
  }

  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const range = maxValue - minValue || 1

  // Расчет прогресса
  const currentWeight = sorted.length > 0 ? sorted[sorted.length - 1].value : startWeight
  let progressPercent: number | null = null
  if (startWeight != null && desiredWeight != null && currentWeight != null) {
    const totalChange = desiredWeight - startWeight
    const currentChange = currentWeight - startWeight
    if (totalChange !== 0) {
      progressPercent = (currentChange / totalChange) * 100
    }
  }

  const chartHeight = 200
  const chartPadding = 20
  const graphHeight = chartHeight - chartPadding * 2

  return (
    <div className="weight-chart">
      <div className="chart-info">
        <p className="chart-title">История веса</p>
        <p className="chart-meta">
          Всего записей: <strong>{sorted.length}</strong> | Дней отслеживания:{' '}
          <strong>{totalDays}</strong>
        </p>
      </div>

      <svg className="chart-svg" viewBox={`0 0 600 ${chartHeight}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartPadding + ratio * graphHeight
          const value = maxValue - ratio * range
          return (
            <g key={`grid-${ratio}`}>
              <line
                x1="40"
                y1={y}
                x2="590"
                y2={y}
                stroke="var(--line)"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
              <text x="35" y={y + 3} textAnchor="end" fontSize="11" fill="var(--muted)">
                {value.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Стартовая точка */}
        {startWeight != null && (
          <g>
            <circle
              cx={40}
              cy={chartPadding + ((maxValue - startWeight) / range) * graphHeight}
              r="4"
              fill="var(--moss)"
              stroke="var(--chart-point-border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <title>{`Стартовый вес: ${startWeight.toFixed(1)} кг`}</title>
          </g>
        )}

        {/* Line connecting points */}
        {sorted.length > 0 && (
          <polyline
            points={
              (startWeight != null ? `40,${chartPadding + ((maxValue - startWeight) / range) * graphHeight} ` : '') +
              sorted
                .map((log) => {
                  const daysSince = daysInclusive(firstDate, parseISODate(log.logged_on)) - 1
                  const x = 40 + (daysSince / Math.max(totalDays - 1, 1)) * 550
                  const normalizedValue = (maxValue - log.value) / range
                  const y = chartPadding + normalizedValue * graphHeight
                  return `${x},${y}`
                })
                .join(' ')
            }
            fill="none"
            stroke="var(--moss)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Data points */}
        {sorted.map((log) => {
          const daysSince = daysInclusive(firstDate, parseISODate(log.logged_on)) - 1
          const x = 40 + (daysSince / Math.max(totalDays - 1, 1)) * 550
          const normalizedValue = (maxValue - log.value) / range
          const y = chartPadding + normalizedValue * graphHeight
          return (
            <g key={`point-${log.logged_on}`}>
              <circle cx={x} cy={y} r="3" fill="var(--moss)" vectorEffect="non-scaling-stroke" />
              <title>{`${log.logged_on}: ${log.value.toFixed(1)} кг`}</title>
            </g>
          )
        })}

        {/* X-axis */}
        <line x1="40" y1={chartHeight - chartPadding} x2="590" y2={chartHeight - chartPadding} stroke="var(--line)" strokeWidth="1" />

        {/* Y-axis */}
        <line x1="40" y1={chartPadding} x2="40" y2={chartHeight - chartPadding} stroke="var(--line)" strokeWidth="1" />
      </svg>

      {progressPercent != null && desiredWeight != null && (
        <div className="progress-bar-container">
          <div className="weight-progress" aria-label={`Целевой вес: ${desiredWeight.toFixed(1)} кг`}>
            <div
              className="weight-progress-fill"
              style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
            />
            <span className="weight-progress-percent">{progressPercent.toFixed(2)}%</span>
            <span className="weight-progress-goal">Цель: {desiredWeight.toFixed(1)} кг</span>
          </div>
        </div>
      )}

      <div className="chart-legend">
        <p>Минимум: <strong>{minValue.toFixed(1)} кг</strong></p>
        <p>Максимум: <strong>{maxValue.toFixed(1)} кг</strong></p>
        <p>Разница: <strong>{(maxValue - minValue).toFixed(1)} кг</strong></p>
      </div>
    </div>
  )
}
