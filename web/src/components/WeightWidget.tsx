import { useState } from 'react'
import { localISODate } from '../lib/dates'
import { useData } from '../hooks/useData'
import type { WeightLog } from '../lib/types'

export function WeightWidget() {
  const { profile, weightLogs, logTodayWeight } = useData()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!profile?.weight_enabled) return null

  const today = localISODate()
  const todayLog = weightLogs.find((w) => w.logged_on === today)
  const current = weightLogs.reduce<WeightLog | null>(
    (latest, log) => (!latest || log.logged_on > latest.logged_on ? log : latest),
    null,
  )?.value ?? null
  async function submit() {
    const parsed = Number(value.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Введите число больше нуля')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await logTodayWeight(parsed)
      setOpen(false)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="weight-block">
      <button
        type="button"
        className="weight-btn"
        onClick={() => {
          setValue(todayLog ? String(todayLog.value) : '')
          setError(null)
          setOpen(true)
        }}
      >
        <span className="weight-label">Текущий вес</span>
        <span className="weight-values">{current != null ? `${formatNum(current)} кг` : '—'}</span>
      </button>

      {open && (
        <div className="popover">
          <p>{todayLog ? 'Отредактируйте вес за сегодня' : 'Внесите вес за сегодня'}</p>
          <input
            type="number"
            step="0.1"
            min="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={todayLog ? String(todayLog.value) : current != null ? String(current) : 'например 72.4'}
          />
          {error && <p className="banner error">{error}</p>}
          <div className="row-actions">
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="button" className="primary compact" onClick={submit} disabled={busy}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatNum(value: number | null | undefined) {
  if (value == null) return '—'
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}
