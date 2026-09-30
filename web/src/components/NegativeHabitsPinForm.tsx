export function NegativeHabitsPinForm({
  id,
  value,
  error,
  label = 'Введите четырёхзначный PIN',
  submitLabel = 'Открыть',
  disabled = false,
  onChange,
  onSubmit,
  onCancel,
}: {
  id: string
  value: string
  error: string | null
  label?: string
  submitLabel?: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const errorId = `${id}-error`

  return (
    <form
      id={id}
      className="negative-habits-pin-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label>
        {label}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="[0-9]{4}"
          maxLength={4}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(normalizePin(event.target.value))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoFocus
        />
      </label>
      <div className="negative-habits-pin-actions">
        <button type="submit" className="primary compact" disabled={disabled || value.length !== 4}>{submitLabel}</button>
        <button type="button" className="ghost compact" disabled={disabled} onClick={onCancel}>Отмена</button>
      </div>
      {error && <p id={errorId} className="negative-habits-pin-error">{error}</p>}
    </form>
  )
}

function normalizePin(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}
