import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { daysInclusive, parseISODate } from '../lib/dates'
import type { WeightLog } from '../lib/types'
import {
  WEIGHT_CHART_WEEKDAYS,
  type WeightChartWeekday,
} from '../lib/weight-chart-weekdays'
import { useViewport } from '../hooks/useViewport'

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
const FULLSCREEN_FIRST_POINT_INSET = 48
const CHART_HEIGHT = 258
const FULLSCREEN_CHART_HEIGHT = 344
const CHART_GRID_SECTIONS = 6
const FORECAST_MONTHS = 12
const MINIMUM_FORECAST_DAYS = 28
const MONTHLY_TREND_RETENTION = 0.94
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

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

function formatMonthAndYear(iso: string) {
  const date = parseISODate(iso)
  const month = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(date)
  return `${month} ${date.getFullYear()}`
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

function addMonthsClamped(iso: string, months: number) {
  const source = parseISODate(iso)
  const targetYear = source.getFullYear()
  const targetMonth = source.getMonth() + months
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const target = new Date(targetYear, targetMonth, Math.min(source.getDate(), lastDay))
  const year = target.getFullYear()
  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createWeightForecast(
  logs: WeightLog[],
  startDate: string | null,
  startWeight: number | null,
  desiredWeight: number | null,
) {
  const valuesByDate = new Map<string, number>()
  if (startDate && startWeight != null) valuesByDate.set(startDate, startWeight)
  for (const log of logs) valuesByDate.set(log.logged_on, log.value)

  const history = [...valuesByDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (history.length < 2) return null

  const firstDate = parseISODate(history[0].date)
  const lastDate = parseISODate(history[history.length - 1].date)
  const spanDays = Math.round((lastDate.getTime() - firstDate.getTime()) / DAY_IN_MILLISECONDS)
  if (spanDays < MINIMUM_FORECAST_DAYS) return null

  const samples = history.map((point) => ({
    x: (parseISODate(point.date).getTime() - firstDate.getTime()) / DAY_IN_MILLISECONDS,
    y: point.value,
  }))
  const count = samples.length
  const sumX = samples.reduce((sum, sample) => sum + sample.x, 0)
  const sumY = samples.reduce((sum, sample) => sum + sample.y, 0)
  const sumXY = samples.reduce((sum, sample) => sum + sample.x * sample.y, 0)
  const sumXSquare = samples.reduce((sum, sample) => sum + sample.x ** 2, 0)
  const denominator = count * sumXSquare - sumX ** 2
  if (denominator === 0) return null

  const dailyTrend = (count * sumXY - sumX * sumY) / denominator
  const lastHistoryPoint = history[history.length - 1]
  const directionToGoal = desiredWeight != null && desiredWeight > 0
    ? Math.sign(desiredWeight - lastHistoryPoint.value)
    : 0
  let previousForecastDate = parseISODate(lastHistoryPoint.date)
  let forecastWeight = lastHistoryPoint.value
  let firstMonthChange = 0
  const points: ChartPoint[] = Array.from({ length: FORECAST_MONTHS }, (_, index) => {
    const date = addMonthsClamped(lastHistoryPoint.date, index + 1)
    const forecastDate = parseISODate(date)
    const intervalDays = (forecastDate.getTime() - previousForecastDate.getTime()) / DAY_IN_MILLISECONDS
    const retainedTrend = MONTHLY_TREND_RETENTION ** (index + 1)
    const intervalChange = dailyTrend * intervalDays * retainedTrend
    const previousWeight = forecastWeight
    forecastWeight += intervalChange
    if (desiredWeight != null && directionToGoal > 0) {
      forecastWeight = Math.min(forecastWeight, desiredWeight)
    } else if (desiredWeight != null && directionToGoal < 0) {
      forecastWeight = Math.max(forecastWeight, desiredWeight)
    } else if (desiredWeight != null && desiredWeight > 0) {
      forecastWeight = desiredWeight
    }
    previousForecastDate = forecastDate
    if (index === 0) firstMonthChange = forecastWeight - previousWeight
    return {
      date,
      value: forecastWeight,
      label: 'Прогноз',
    }
  })

  return { points, firstMonthChange }
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
  const [modelingEnabled, setModelingEnabled] = useState(false)
  const [modelingError, setModelingError] = useState<string | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null)
  const chartGraphRef = useRef<HTMLDivElement>(null)
  const { width: viewportWidth } = useViewport()
  const compactMobileChart = viewportWidth > 0 && viewportWidth <= 600
  const selectedWeekday = WEIGHT_CHART_WEEKDAYS.find((option) => option.value === filterWeekday) ?? WEIGHT_CHART_WEEKDAYS[0]

  useEffect(() => {
    if (!forceAllPoints) return
    const frame = window.requestAnimationFrame(() => {
      if (chartGraphRef.current) {
        chartGraphRef.current.scrollLeft = chartGraphRef.current.scrollWidth
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [forceAllPoints, logs, weekdayFilterEnabled, monthFilterEnabled, modelingEnabled, filterWeekday])

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
  const forecast = createWeightForecast(sorted, startDate, startWeight, desiredWeight)
  const filteredLogs = modelingEnabled
    ? sorted
    : monthFilterEnabled
    ? selectMonthlyLogs(sorted)
    : weekdayFilterEnabled
      ? sorted.filter((log) => isSelectedWeekday(log.logged_on, filterWeekday))
      : sorted
  const compactWeekdayView = weekdayFilterEnabled && !forceAllPoints && !fullscreen
  const includeStartPoint = startWeight != null && !compactWeekdayView && (
    modelingEnabled || monthFilterEnabled || !weekdayFilterEnabled || isSelectedWeekday(startDate, filterWeekday)
  )
  const maximumLogPoints = Math.max(0, 7 - (includeStartPoint ? 1 : 0))
  const visibleLogs = modelingEnabled
    ? sorted
    : forceAllPoints || fullscreen
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
  const forecastPoints = modelingEnabled && forecast ? forecast.points : []
  const currentWeight = sorted.length > 0 ? sorted[sorted.length - 1].value : startWeight
  const chartPoints = visibleLogs.map((log) => ({ date: log.logged_on, value: log.value, label: 'Вес' }))
  const startPoint = includeStartPoint ? { date: startDate, value: startWeight, label: 'Стартовый вес' } : null
  const allHistoricalPoints = startPoint ? [startPoint, ...chartPoints] : chartPoints
  const historicalPoints = modelingEnabled ? allHistoricalPoints.slice(-1) : allHistoricalPoints
  const renderedPoints = [...historicalPoints, ...forecastPoints]
  const goalReachedForecastIndex = modelingEnabled
    && desiredWeight != null
    && desiredWeight > 0
    && currentWeight != null
    && Math.abs(currentWeight - desiredWeight) > 0.005
    ? forecastPoints.findIndex((point) => Math.abs(point.value - desiredWeight) < 0.005)
    : -1
  const recordedValues = [
    ...(startWeight != null ? [startWeight] : []),
    ...sorted.map((log) => log.value),
  ]
  const recordedMinimum = recordedValues.length > 0 ? Math.min(...recordedValues) : 0
  const recordedMaximum = recordedValues.length > 0 ? Math.max(...recordedValues) : 0
  const allValues = renderedPoints.map((point) => point.value)
  const hasChartData = allValues.length > 0

  const minValue = hasChartData ? Math.min(...allValues) : 0
  const maxValue = hasChartData ? Math.max(...allValues) : 1
  const range = maxValue - minValue || 1
  const chartWidth = forceAllPoints
    ? Math.max(900, renderedPoints.length * (modelingEnabled ? 128 : 104))
    : compactMobileChart
      ? 440
      : 600
  const chartHeight = forceAllPoints
    ? FULLSCREEN_CHART_HEIGHT
    : compactMobileChart
      ? 300
      : CHART_HEIGHT
  const chartPlotLeft = forceAllPoints ? CHART_LEFT + FULLSCREEN_FIRST_POINT_INSET : CHART_LEFT
  const chartRight = chartWidth - CHART_RIGHT_PADDING
  const chartTop = 58
  const chartBottom = modelingEnabled ? 48 : 34
  const graphHeight = chartHeight - chartTop - chartBottom
  const gridRatios = Array.from(
    { length: CHART_GRID_SECTIONS + 1 },
    (_, index) => index / CHART_GRID_SECTIONS,
  )

  let progressPercent: number | null = null
  if (startWeight != null && desiredWeight != null && currentWeight != null) {
    const totalChange = desiredWeight - startWeight
    const currentChange = currentWeight - startWeight
    if (totalChange !== 0) progressPercent = (currentChange / totalChange) * 100
  }

  const pointPosition = (point: ChartPoint, index: number) => {
    return {
      x: chartPlotLeft + (index / Math.max(renderedPoints.length - 1, 1)) * (chartRight - chartPlotLeft),
      y: chartTop + ((maxValue - point.value) / range) * graphHeight,
    }
  }

  function handleChartMouseMove(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const cursorX = ((event.clientX - bounds.left) / bounds.width) * chartWidth
    const step = (chartRight - chartPlotLeft) / Math.max(renderedPoints.length - 1, 1)
    const pointIndex = Math.min(
      renderedPoints.length - 1,
      Math.max(0, Math.floor((cursorX - chartPlotLeft) / step)),
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
                      setModelingEnabled(false)
                    }
                    setModelingError(null)
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
                      if (nextEnabled) {
                        setWeekdayFilterEnabled(false)
                        setModelingEnabled(false)
                      }
                      setModelingError(null)
                      setHoveredPoint(null)
                    }}
                  >
                    Фильтр:месяц
                  </button>
                )}
                {forceAllPoints && (
                  <button
                    type="button"
                    className={modelingEnabled ? 'chart-filter-button active' : 'chart-filter-button'}
                    aria-pressed={modelingEnabled}
                    onClick={() => {
                      if (modelingEnabled) {
                        setModelingEnabled(false)
                        setModelingError(null)
                      } else if (!forecast) {
                        setModelingError('Недостаточно данных, нужно 4 недели для прогноза')
                      } else {
                        setModelingEnabled(true)
                        setWeekdayFilterEnabled(false)
                        setMonthFilterEnabled(false)
                        setModelingError(null)
                      }
                      setHoveredPoint(null)
                    }}
                  >
                    Моделирование
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
            {modelingEnabled
              ? <>Исторических записей: <strong>{filteredLogs.length}</strong> | Прогноз: <strong>{FORECAST_MONTHS} месяцев</strong></>
              : <>{monthFilterEnabled
              ? 'Записей по месяцам'
              : weekdayFilterEnabled
                ? `Записей ${selectedWeekday.recordsLabel}`
                : 'Дней зафиксировано'}: <strong>{filteredLogs.length}</strong>
              </>}
            {forceAllPoints && <> | Прошло дней с первой записи: <strong>{totalDays}</strong></>}
            {!modelingEnabled && !fullscreen && renderedPoints.length < filteredLogs.length + (includeStartPoint ? 1 : 0) && ` | На графике: ${renderedPoints.length}`}
          </p>
          {modelingError && <p className="chart-modeling-error" role="alert">{modelingError}</p>}
        </div>

        <div ref={chartGraphRef} className="chart-graph">
          {hasChartData ? (
            <div
              className={forceAllPoints ? 'chart-canvas fullscreen' : 'chart-canvas'}
              style={forceAllPoints ? { width: `${chartWidth}px`, height: `${chartHeight}px` } : undefined}
            >
              {forceAllPoints && (
                <svg
                  className="chart-y-axis-sticky"
                  viewBox={`0 0 ${CHART_LEFT} ${chartHeight}`}
                  style={{ width: `${CHART_LEFT}px`, height: `${chartHeight}px` }}
                  aria-hidden="true"
                >
                  {gridRatios.map((ratio) => {
                    const y = chartTop + ratio * graphHeight
                    const value = maxValue - ratio * range
                    return (
                      <text key={`sticky-grid-${ratio}`} x="35" y={y + 3.6} textAnchor="end" fontSize="13.2" fill="var(--muted)">
                        {value.toFixed(1)}
                      </text>
                    )
                  })}
                  <line
                    x1={CHART_LEFT - 0.5}
                    y1={chartTop}
                    x2={CHART_LEFT - 0.5}
                    y2={chartHeight - chartBottom}
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                </svg>
              )}
              <svg
                className="chart-svg"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="xMinYMid meet"
                style={forceAllPoints ? { width: `${chartWidth}px`, height: `${chartHeight}px` } : undefined}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={() => setHoveredPoint(null)}
              >
            {gridRatios.map((ratio, index) => {
              const y = chartTop + ratio * graphHeight
              const value = maxValue - ratio * range
              return (
                <g key={`grid-${ratio}`}>
                  <line x1={CHART_LEFT} y1={y} x2={chartRight} y2={y} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2,2" />
                  {!forceAllPoints && (index === 0 || index === CHART_GRID_SECTIONS) && (
                    <text x="35" y={y + 3.6} textAnchor="end" fontSize="13.2" fill="var(--muted)">{value.toFixed(1)}</text>
                  )}
                </g>
              )
            })}

            {historicalPoints.length > 1 && (
              <polyline
                points={historicalPoints.map((point, index) => {
                  const { x, y } = pointPosition(point, index)
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="var(--moss)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {forecastPoints.map((point, index) => {
              const { x, y } = pointPosition(point, historicalPoints.length + index)
              return (
                <line
                  key={`forecast-guide-${point.date}`}
                  x1={x}
                  y1={y + 5}
                  x2={x}
                  y2={chartHeight - chartBottom}
                  stroke="var(--training-marker)"
                  strokeWidth={index === goalReachedForecastIndex ? 2 : 1}
                  opacity={index === goalReachedForecastIndex ? 0.8 : 0.35}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}

            {forecastPoints.length > 0 && historicalPoints.length > 0 && (
              <polyline
                className="chart-forecast-line"
                points={[
                  { point: historicalPoints[historicalPoints.length - 1], index: historicalPoints.length - 1 },
                  ...forecastPoints.map((point, index) => ({ point, index: historicalPoints.length + index })),
                ].map(({ point, index }) => {
                  const { x, y } = pointPosition(point, index)
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="var(--training-marker)"
                strokeWidth="2"
                strokeDasharray="7,5"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {renderedPoints.map((point, index) => {
              const { x, y } = pointPosition(point, index)
              const isGoalReachedMonth = point.label === 'Прогноз'
                && index - historicalPoints.length === goalReachedForecastIndex
              return (
                <circle
                  key={`${point.label}-${point.date}`}
                  cx={x}
                  cy={y}
                  r={isGoalReachedMonth ? 5 : point.label === 'Стартовый вес' ? 4 : 3}
                  fill={point.label === 'Прогноз' ? 'var(--training-marker)' : 'var(--moss)'}
                  stroke={isGoalReachedMonth ? 'var(--surface)' : point.label === 'Стартовый вес' ? 'var(--chart-point-border)' : 'none'}
                  strokeWidth={isGoalReachedMonth ? 2 : 1}
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
              const isGoalReachedMonth = point.label === 'Прогноз'
                && index - historicalPoints.length === goalReachedForecastIndex
              return (
                <g key={`label-${point.label}-${point.date}`}>
                  {isGoalReachedMonth && <title>Прогнозируемое достижение цели</title>}
                  <text className="chart-point-details" x={x} y={y - 26.4} textAnchor="middle" fill="var(--ink)">
                    <tspan className="chart-point-weight" x={x} fill={getWeightGoalColor(point.value, desiredWeight)}>
                      {point.value.toFixed(1)} кг
                    </tspan>
                    <tspan className="chart-point-difference" x={x} dy="14.4">
                      {formatWeightDifference(
                        point.value,
                        index === 0 ? previousHiddenLog?.value : renderedPoints[index - 1]?.value,
                      )}
                    </tspan>
                  </text>
                  {isGoalReachedMonth && (
                    <rect
                      x={x - 60}
                      y={chartHeight - 28}
                      width="120"
                      height="24"
                      rx="8"
                      fill="var(--training-marker)"
                      fillOpacity="0.22"
                      stroke="var(--training-marker)"
                      strokeOpacity="0.8"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <text
                    className="chart-point-details chart-point-date"
                    x={x}
                    y={modelingEnabled ? chartHeight - (point.label === 'Прогноз' ? 10 : 23) : y + 16.8}
                    textAnchor="middle"
                    fill="var(--ink)"
                    fontWeight={isGoalReachedMonth ? 800 : undefined}
                  >
                    {point.label === 'Прогноз' ? (
                      <tspan x={x}>{formatMonthAndYear(point.date)}</tspan>
                    ) : (
                      <>
                        <tspan x={x}>{formatDayAndMonth(point.date)}</tspan>
                        <tspan x={x} dy="13.2">{parseISODate(point.date).getFullYear()}</tspan>
                      </>
                    )}
                  </text>
                </g>
              )
            })}

            <line x1={CHART_LEFT} y1={chartHeight - chartBottom} x2={chartRight} y2={chartHeight - chartBottom} stroke="var(--line)" strokeWidth="1" />
            {!forceAllPoints && (
              <line x1={CHART_LEFT} y1={chartTop} x2={CHART_LEFT} y2={chartHeight - chartBottom} stroke="var(--line)" strokeWidth="1" />
            )}
              </svg>
            </div>
          ) : <p className="weight-chart-filter-empty">
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
          <p>Минимум: <strong>{recordedMinimum.toFixed(1)} кг</strong></p>
          <div className="chart-legend-pair">
            <p>Разница: <strong>{(recordedMaximum - recordedMinimum).toFixed(1)} кг</strong></p>
            <p>Суток: <strong>{totalDays}</strong></p>
          </div>
          <p>Максимум: <strong>{recordedMaximum.toFixed(1)} кг</strong></p>
          {modelingEnabled && forecast && (
            <p className="chart-forecast-legend">Первый месяц прогноза: <strong>{forecast.firstMonthChange >= 0 ? '+' : ''}{forecast.firstMonthChange.toFixed(1)} кг</strong></p>
          )}
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
