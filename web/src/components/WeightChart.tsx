import { useState, type MouseEvent } from 'react'
import { daysInclusive, parseISODate } from '../lib/dates'
import type { WeightLog } from '../lib/types'

type WeightChartProps = {
  logs: WeightLog[]
  startDate: string | null
  startWeight: number | null
  desiredWeight: number | null
  forceAllPoints?: boolean
  hideFullscreenButton?: boolean
}

type ChartPoint = {
  date: string
  value: number
  label: string
}

const CHART_PADDING = 20
const CHART_LEFT = 40
const CHART_RIGHT = 590
const CHART_HEIGHT = 200

function selectEvenlySpacedLogs(logs: WeightLog[], maximum = 7) {
  if (logs.length <= maximum) return logs

  return Array.from({ length: maximum }, (_, index) => (
    logs[Math.round(index * (logs.length - 1) / (maximum - 1))]
  ))
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseISODate(iso))
}

export function WeightChart({ logs, startDate, startWeight, desiredWeight, forceAllPoints = false, hideFullscreenButton = false }: WeightChartProps) {
  const [fullscreen, setFullscreen] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null)

  if (!startDate) {
    return <div className="weight-chart-empty">Нет данных о весе</div>
  }

  const sorted = [...logs].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
  const visibleLogs = forceAllPoints || fullscreen ? sorted : selectEvenlySpacedLogs(sorted)
  const firstDate = parseISODate(startDate)
  const lastDate = sorted.length > 0 ? parseISODate(sorted[sorted.length - 1].logged_on) : firstDate
  const totalDays = daysInclusive(firstDate, lastDate)
  const allValues = startWeight != null ? [startWeight, ...sorted.map((log) => log.value)] : sorted.map((log) => log.value)

  if (allValues.length === 0) {
    return <div className="weight-chart-empty">Нет данных о весе</div>
  }

  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const range = maxValue - minValue || 1
  const graphHeight = CHART_HEIGHT - CHART_PADDING * 2
  const currentWeight = sorted.length > 0 ? sorted[sorted.length - 1].value : startWeight
  const chartPoints = visibleLogs.map((log) => ({ date: log.logged_on, value: log.value, label: 'Вес' }))
  const startPoint = startWeight == null ? null : { date: startDate, value: startWeight, label: 'Стартовый вес' }

  let progressPercent: number | null = null
  if (startWeight != null && desiredWeight != null && currentWeight != null) {
    const totalChange = desiredWeight - startWeight
    const currentChange = currentWeight - startWeight
    if (totalChange !== 0) progressPercent = (currentChange / totalChange) * 100
  }

  const pointPosition = (point: ChartPoint, index: number) => {
    return {
      x: CHART_LEFT + (index / Math.max(renderedPoints.length - 1, 1)) * (CHART_RIGHT - CHART_LEFT),
      y: CHART_PADDING + ((maxValue - point.value) / range) * graphHeight,
    }
  }

  const renderedPoints = startPoint ? [startPoint, ...chartPoints] : chartPoints

  function handleChartMouseMove(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const cursorX = ((event.clientX - bounds.left) / bounds.width) * 600
    const step = (CHART_RIGHT - CHART_LEFT) / Math.max(renderedPoints.length - 1, 1)
    const pointIndex = Math.min(
      renderedPoints.length - 1,
      Math.max(0, Math.floor((cursorX - CHART_LEFT) / step)),
    )
    setHoveredPoint(renderedPoints[pointIndex] ?? null)
  }

  return (
    <>
      <div className={forceAllPoints || fullscreen ? 'weight-chart fullscreen' : 'weight-chart'}>
        <div className="chart-info">
          <div className="chart-heading">
            <p className="chart-title">История веса</p>
            {!hideFullscreenButton && <button type="button" className="chart-fullscreen-button" onClick={() => setFullscreen(true)}>Все записи</button>}
          </div>
          <p className="chart-meta">
            Всего записей: <strong>{sorted.length}</strong> | Дней отслеживания: <strong>{totalDays}</strong>
            {!fullscreen && sorted.length > visibleLogs.length && ` | На графике: ${visibleLogs.length}`}
          </p>
        </div>

        <div className="chart-graph">
          <svg
            className="chart-svg"
            viewBox={`0 0 600 ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = CHART_PADDING + ratio * graphHeight
              const value = maxValue - ratio * range
              return (
                <g key={`grid-${ratio}`}>
                  <line x1={CHART_LEFT} y1={y} x2={CHART_RIGHT} y2={y} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2,2" />
                  <text x="35" y={y + 3} textAnchor="end" fontSize="11" fill="var(--muted)">{value.toFixed(1)}</text>
                </g>
              )
            })}

            {renderedPoints.length > 1 && (
              <polyline
                points={renderedPoints.map((point, index) => {
                  const { x, y } = pointPosition(point, index)
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="var(--moss)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {renderedPoints.map((point, index) => {
              const { x, y } = pointPosition(point, index)
              return (
                <circle
                  key={`${point.label}-${point.date}`}
                  cx={x}
                  cy={y}
                  r={point.label === 'Стартовый вес' ? 4 : 3}
                  fill="var(--moss)"
                  stroke={point.label === 'Стартовый вес' ? 'var(--chart-point-border)' : 'none'}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onFocus={() => setHoveredPoint(point)}
                  onBlur={() => setHoveredPoint(null)}
                />
              )
            })}

            <line x1={CHART_LEFT} y1={CHART_HEIGHT - CHART_PADDING} x2={CHART_RIGHT} y2={CHART_HEIGHT - CHART_PADDING} stroke="var(--line)" strokeWidth="1" />
            <line x1={CHART_LEFT} y1={CHART_PADDING} x2={CHART_LEFT} y2={CHART_HEIGHT - CHART_PADDING} stroke="var(--line)" strokeWidth="1" />
          </svg>
          {hoveredPoint && (
            <div className="chart-tooltip" role="status">
              <strong>{hoveredPoint.value.toFixed(1)} кг</strong>
              <span>{formatDate(hoveredPoint.date)}</span>
            </div>
          )}
        </div>

        {progressPercent != null && desiredWeight != null && (
          <div className="progress-bar-container">
            <div className="weight-progress" aria-label={`Целевой вес: ${desiredWeight.toFixed(1)} кг`}>
              <div className="weight-progress-fill" style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }} />
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

      {fullscreen && !forceAllPoints && (
        <div className="chart-fullscreen-backdrop" role="presentation">
          <div className="weight-chart-fullscreen" role="dialog" aria-modal="true" aria-label="Полная история веса">
            <button type="button" className="chart-close-button" onClick={() => setFullscreen(false)} aria-label="Закрыть полную историю веса">×</button>
            <div className="chart-fullscreen-content">
              <WeightChart logs={logs} startDate={startDate} startWeight={startWeight} desiredWeight={desiredWeight} forceAllPoints hideFullscreenButton />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
