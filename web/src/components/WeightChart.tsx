import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { daysInclusive, parseISODate } from '../lib/dates'
import type { WeightLog } from '../lib/types'
import {
  WEIGHT_CHART_WEEKDAYS,
  type WeightChartWeekday,
} from '../lib/weight-chart-weekdays'

type WeightChartProps = {
  logs: WeightLog[]
  startDate: string | null
  startWeight: number | null
  desiredWeight: number | null
  forceAllPoints?: boolean
  hideFullscreenButton?: boolean
  filterWeekday?: WeightChartWeekday
  initialWeekdayFilterEnabled?: boolean
  initialMonthFilterEnabled?: boolean
  onCloseFullscreen?: () => void
}

type ChartPoint = {
  date: string
  value: number
  label: string
}

const CHART_LEFT = 52
const CHART_RIGHT_PADDING = 52
const CHART_HEIGHT = 258
const FULLSCREEN_CHART_HEIGHT = 344
const CHART_GRID_SECTIONS = 6

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

function formatDayAndMonth(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(parseISODate(iso))
}

function formatWeightDifference(value: number, previousValue?: number) {
  if (previousValue == null) return '—'
  const difference = value - previousValue
  const sign = difference > 0 ? '+' : ''
  return `${sign}${difference.toFixed(1)} кг`
}

function getWeightGoalColor(value: number, desiredWeight: number | null) {
  if (desiredWeight == null || desiredWeight <= 0) return 'var(--ink)'

  const maximumDifference = desiredWeight * 0.5
  const distance = Math.min(Math.abs(value - desiredWeight) / maximumDifference, 1)
  const hue = Math.round(130 * (1 - distance))
  const saturation = Math.round(55 + 15 * distance)
  const lightness = Math.round(58 - 26 * distance)
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function isSelectedWeekday(iso: string, weekday: WeightChartWeekday) {
  return parseISODate(iso).getDay() === weekday
}

function selectMonthlyLogs(logs: WeightLog[]) {
  const firstLogByMonth = new Map<string, WeightLog>()
  for (const log of logs) {
    const monthKey = log.logged_on.slice(0, 7)
    if (!firstLogByMonth.has(monthKey)) firstLogByMonth.set(monthKey, log)
  }
  return [...firstLogByMonth.values()]
}

export function WeightChart({
  logs,
  startDate,
  startWeight,
  desiredWeight,
  forceAllPoints = false,
  hideFullscreenButton = false,
  filterWeekday = 1,
  initialWeekdayFilterEnabled = false,
  initialMonthFilterEnabled = false,
  onCloseFullscreen,
}: WeightChartProps) {
  const [fullscreen, setFullscreen] = useState(false)
  const [weekdayFilterEnabled, setWeekdayFilterEnabled] = useState(initialWeekdayFilterEnabled)
  const [monthFilterEnabled, setMonthFilterEnabled] = useState(initialMonthFilterEnabled)
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null)
  const chartGraphRef = useRef<HTMLDivElement>(null)
  const selectedWeekday = WEIGHT_CHART_WEEKDAYS.find((option) => option.value === filterWeekday) ?? WEIGHT_CHART_WEEKDAYS[0]

  useEffect(() => {
    if (!forceAllPoints) return
    const frame = window.requestAnimationFrame(() => {
      if (chartGraphRef.current) {
        chartGraphRef.current.scrollLeft = chartGraphRef.current.scrollWidth
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [forceAllPoints, logs, weekdayFilterEnabled, monthFilterEnabled, filterWeekday])

  useEffect(() => {
    if (!fullscreen || forceAllPoints) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [fullscreen, forceAllPoints])

  if (!startDate) {
    return <div className="weight-chart-empty">Нет данных о весе</div>
  }

  const sorted = [...logs].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
  const filteredLogs = monthFilterEnabled
    ? selectMonthlyLogs(sorted)
    : weekdayFilterEnabled
      ? sorted.filter((log) => isSelectedWeekday(log.logged_on, filterWeekday))
      : sorted
  const compactWeekdayView = weekdayFilterEnabled && !forceAllPoints && !fullscreen
  const includeStartPoint = startWeight != null && !compactWeekdayView && (
    monthFilterEnabled || !weekdayFilterEnabled || isSelectedWeekday(startDate, filterWeekday)
  )
  const maximumLogPoints = Math.max(0, 7 - (includeStartPoint ? 1 : 0))
  const visibleLogs = forceAllPoints || fullscreen
    ? filteredLogs
    : weekdayFilterEnabled
      ? filteredLogs.slice(-7)
      : selectEvenlySpacedLogs(filteredLogs, maximumLogPoints)
  const previousHiddenLog = compactWeekdayView && filteredLogs.length > visibleLogs.length
    ? filteredLogs[filteredLogs.length - visibleLogs.length - 1]
    : null
  const firstDate = parseISODate(startDate)
  const lastDate = sorted.length > 0 ? parseISODate(sorted[sorted.length - 1].logged_on) : firstDate
  const totalDays = daysInclusive(firstDate, lastDate)
  const scaleLogs = compactWeekdayView ? visibleLogs : filteredLogs
  const allValues = includeStartPoint ? [startWeight, ...scaleLogs.map((log) => log.value)] : scaleLogs.map((log) => log.value)
  const hasChartData = allValues.length > 0

  const minValue = hasChartData ? Math.min(...allValues) : 0
  const maxValue = hasChartData ? Math.max(...allValues) : 1
  const range = maxValue - minValue || 1
  const currentWeight = sorted.length > 0 ? sorted[sorted.length - 1].value : startWeight
  const chartPoints = visibleLogs.map((log) => ({ date: log.logged_on, value: log.value, label: 'Вес' }))
  const startPoint = includeStartPoint ? { date: startDate, value: startWeight, label: 'Стартовый вес' } : null
  const renderedPoints = startPoint ? [startPoint, ...chartPoints] : chartPoints
  const chartWidth = forceAllPoints ? Math.max(900, renderedPoints.length * 104) : 600
  const chartHeight = forceAllPoints ? FULLSCREEN_CHART_HEIGHT : CHART_HEIGHT
  const chartRight = chartWidth - CHART_RIGHT_PADDING
  const chartTop = 58
  const chartBottom = 34
  const graphHeight = chartHeight - chartTop - chartBottom

  let progressPercent: number | null = null
  if (startWeight != null && desiredWeight != null && currentWeight != null) {
    const totalChange = desiredWeight - startWeight
    const currentChange = currentWeight - startWeight
    if (totalChange !== 0) progressPercent = (currentChange / totalChange) * 100
  }

  const pointPosition = (point: ChartPoint, index: number) => {
    return {
      x: CHART_LEFT + (index / Math.max(renderedPoints.length - 1, 1)) * (chartRight - CHART_LEFT),
      y: chartTop + ((maxValue - point.value) / range) * graphHeight,
    }
  }

  function handleChartMouseMove(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const cursorX = ((event.clientX - bounds.left) / bounds.width) * chartWidth
    const step = (chartRight - CHART_LEFT) / Math.max(renderedPoints.length - 1, 1)
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
            {(!hideFullscreenButton || forceAllPoints) && (
              <div className="chart-actions">
                {!hideFullscreenButton && (
                  <button type="button" className="chart-fullscreen-button" onClick={() => setFullscreen(true)}>Все записи</button>
                )}
                <button
                  type="button"
                  className={weekdayFilterEnabled ? 'chart-filter-button active' : 'chart-filter-button'}
                  aria-pressed={weekdayFilterEnabled}
                  onClick={() => {
                    const nextEnabled = !weekdayFilterEnabled
                    setWeekdayFilterEnabled(nextEnabled)
                    if (nextEnabled) {
                      setMonthFilterEnabled(false)
                    }
                    setHoveredPoint(null)
                  }}
                >
                  Фильтр:{selectedWeekday.short.toUpperCase()}
                </button>
                {forceAllPoints && (
                  <button
                    type="button"
                    className={monthFilterEnabled ? 'chart-filter-button active' : 'chart-filter-button'}
                    aria-pressed={monthFilterEnabled}
                    onClick={() => {
                      const nextEnabled = !monthFilterEnabled
                      setMonthFilterEnabled(nextEnabled)
                      if (nextEnabled) setWeekdayFilterEnabled(false)
                      setHoveredPoint(null)
                    }}
                  >
                    Фильтр:месяц
                  </button>
                )}
                {forceAllPoints && onCloseFullscreen && (
                  <button
                    type="button"
                    className="chart-close-button"
                    onClick={onCloseFullscreen}
                    aria-label="Закрыть полную историю веса"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="chart-meta">
            {monthFilterEnabled
              ? 'Записей по месяцам'
              : weekdayFilterEnabled
                ? `Записей ${selectedWeekday.recordsLabel}`
                : 'Всего записей'}: <strong>{filteredLogs.length}</strong> | Дней отслеживания: <strong>{totalDays}</strong>
            {!fullscreen && renderedPoints.length < filteredLogs.length + (includeStartPoint ? 1 : 0) && ` | На графике: ${renderedPoints.length}`}
          </p>
        </div>

        <div ref={chartGraphRef} className="chart-graph">
          {hasChartData ? <svg
            className="chart-svg"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="xMinYMid meet"
            style={forceAllPoints ? { width: `${chartWidth}px`, height: `${chartHeight}px` } : undefined}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {Array.from({ length: CHART_GRID_SECTIONS + 1 }, (_, index) => index / CHART_GRID_SECTIONS).map((ratio) => {
              const y = chartTop + ratio * graphHeight
              const value = maxValue - ratio * range
              return (
                <g key={`grid-${ratio}`}>
                  <line x1={CHART_LEFT} y1={y} x2={chartRight} y2={y} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2,2" />
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

            {renderedPoints.map((point, index) => {
              const { x, y } = pointPosition(point, index)
              return (
                <g key={`label-${point.label}-${point.date}`}>
                  <text className="chart-point-details" x={x} y={y - 22} textAnchor="middle" fill="var(--ink)">
                    <tspan className="chart-point-weight" x={x} fill={getWeightGoalColor(point.value, desiredWeight)}>
                      {point.value.toFixed(1)} кг
                    </tspan>
                    <tspan className="chart-point-difference" x={x} dy="12">
                      {formatWeightDifference(
                        point.value,
                        index === 0 ? previousHiddenLog?.value : renderedPoints[index - 1]?.value,
                      )}
                    </tspan>
                  </text>
                  <text className="chart-point-details chart-point-date" x={x} y={y + 14} textAnchor="middle" fill="var(--ink)">
                    <tspan x={x}>{formatDayAndMonth(point.date)}</tspan>
                    <tspan x={x} dy="11">{parseISODate(point.date).getFullYear()}</tspan>
                  </text>
                </g>
              )
            })}

            <line x1={CHART_LEFT} y1={chartHeight - chartBottom} x2={chartRight} y2={chartHeight - chartBottom} stroke="var(--line)" strokeWidth="1" />
            <line x1={CHART_LEFT} y1={chartTop} x2={CHART_LEFT} y2={chartHeight - chartBottom} stroke="var(--line)" strokeWidth="1" />
          </svg> : <p className="weight-chart-filter-empty">
            {monthFilterEnabled
              ? 'Нет записей о весе по месяцам'
              : weekdayFilterEnabled
                ? `Нет записей о весе за ${selectedWeekday.emptyLabel}`
                : 'Нет записей о весе'}
          </p>}
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

        {hasChartData && <div className="chart-legend">
          <p>Минимум: <strong>{minValue.toFixed(1)} кг</strong></p>
          <p>Максимум: <strong>{maxValue.toFixed(1)} кг</strong></p>
          <p>Разница: <strong>{(maxValue - minValue).toFixed(1)} кг</strong></p>
        </div>}
      </div>

      {fullscreen && !forceAllPoints && (
        <div className="chart-fullscreen-backdrop" role="presentation">
          <div className="weight-chart-fullscreen" role="dialog" aria-modal="true" aria-label="Полная история веса">
            <div className="chart-fullscreen-content">
              <WeightChart
                logs={logs}
                startDate={startDate}
                startWeight={startWeight}
                desiredWeight={desiredWeight}
                forceAllPoints
                hideFullscreenButton
                filterWeekday={filterWeekday}
                initialWeekdayFilterEnabled={weekdayFilterEnabled}
                initialMonthFilterEnabled={monthFilterEnabled}
                onCloseFullscreen={() => setFullscreen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
