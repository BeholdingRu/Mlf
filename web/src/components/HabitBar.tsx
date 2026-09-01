type HabitBarProps = {
  value: number
  label?: string
}

export function HabitBar({ value, label = 'формирование привычки' }: HabitBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const displayValue = Number(clamped).toFixed(2)

  return (
    <div className="habit">
      <div className="habit-meta">
        <span>{label}</span>
        <strong>{displayValue}%</strong>
      </div>
      <div className="habit-track" aria-hidden="true">
        <div className="habit-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
