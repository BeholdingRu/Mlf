import { useId, useState } from 'react'

type HabitBarProps = {
  value: number
  label?: string
  valueLabel?: string | null
  phaseInfo?: string
  hideTrack?: boolean
}

export function HabitBar({ value, label = 'формирование привычки', valueLabel, phaseInfo, hideTrack = false }: HabitBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const displayValue = Number(clamped).toFixed(2)
  const [phaseInfoOpen, setPhaseInfoOpen] = useState(false)
  const phaseInfoId = useId()

  return (
    <div className="habit">
      <div className="habit-meta">
        <div className="habit-phase-label">
          <span>{label}</span>
          {phaseInfo && (
            <div className="habit-phase-info-wrap">
              <button
                type="button"
                className="info-button habit-phase-info-button"
                aria-label={`Информация: ${label}`}
                aria-expanded={phaseInfoOpen}
                aria-controls={phaseInfoId}
                onClick={() => setPhaseInfoOpen((open) => !open)}
              >
                i
              </button>
              {phaseInfoOpen && <div id={phaseInfoId} className="habit-phase-info" role="status">{phaseInfo}</div>}
            </div>
          )}
        </div>
        {valueLabel !== null && <strong>{valueLabel ?? `${displayValue}%`}</strong>}
      </div>
      {!hideTrack && (
        <div className="habit-track" aria-hidden="true">
          <div className="habit-fill" style={{ width: `${clamped}%` }} />
        </div>
      )}
    </div>
  )
}
