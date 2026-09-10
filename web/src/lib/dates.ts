export function localISODate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateTimePartsInTimeZone(date: Date, timeZone: string | null | undefined) {
  const selectedTimeZone = timeZone || 'Europe/Moscow'
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: selectedTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
      second: value('second'),
    }
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    }
  }
}

export function isoDateInTimeZone(timeZone: string | null | undefined, date = new Date()) {
  const parts = dateTimePartsInTimeZone(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function millisecondsUntilNextDayInTimeZone(timeZone: string | null | undefined, date = new Date()) {
  const parts = dateTimePartsInTimeZone(date, timeZone)
  const elapsedWholeSeconds = parts.hour * 3_600 + parts.minute * 60 + parts.second
  return (86_400 - elapsedWholeSeconds) * 1_000 - date.getMilliseconds() + 1_000
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function startOfWeekMonday(date = new Date()): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = copy.getDay()
  const offset = weekday === 0 ? 6 : weekday - 1
  copy.setDate(copy.getDate() - offset)
  return copy
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function daysInclusive(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((b - a) / 86_400_000) + 1
}

export function inRange(iso: string, fromIso: string, toIso: string): boolean {
  return iso >= fromIso && iso <= toIso
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.min(100, (part / whole) * 100)
}
