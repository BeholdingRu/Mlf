const ADMIN_TEST_TIME_STORAGE_KEY = 'mlf:admin-test-date-time'
const ADMIN_TEST_TIME_STARTED_AT_STORAGE_KEY = 'mlf:admin-test-time-started-at'
export const ADMIN_TEST_TIME_CHANGE_EVENT = 'mlf:admin-test-time-change'

export function getSavedAdminTestDateTime() {
  return window.sessionStorage.getItem(ADMIN_TEST_TIME_STORAGE_KEY) ?? ''
}

export function saveAdminTestDateTime(value: string) {
  if (value) window.sessionStorage.setItem(ADMIN_TEST_TIME_STORAGE_KEY, value)
  else window.sessionStorage.removeItem(ADMIN_TEST_TIME_STORAGE_KEY)
  window.sessionStorage.removeItem(ADMIN_TEST_TIME_STARTED_AT_STORAGE_KEY)
  window.dispatchEvent(new Event(ADMIN_TEST_TIME_CHANGE_EVENT))
}

export function startAdminTestTime(value: string) {
  if (!value) return
  window.sessionStorage.setItem(ADMIN_TEST_TIME_STORAGE_KEY, value)
  window.sessionStorage.setItem(ADMIN_TEST_TIME_STARTED_AT_STORAGE_KEY, String(Date.now()))
  window.dispatchEvent(new Event(ADMIN_TEST_TIME_CHANGE_EVENT))
}

export function isAdminTestTimeRunning() {
  return Number.isFinite(Number(window.sessionStorage.getItem(ADMIN_TEST_TIME_STARTED_AT_STORAGE_KEY)))
    && window.sessionStorage.getItem(ADMIN_TEST_TIME_STARTED_AT_STORAGE_KEY) !== null
}

export function getAdminTestTime(timeZone: string | null | undefined) {
  const value = getSavedAdminTestDateTime()
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day, hour, minute] = match.map(Number)
  const intendedUtc = Date.UTC(year, month - 1, day, hour, minute)
  const zone = timeZone || 'Europe/Moscow'
  let candidate = new Date(intendedUtc)

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(candidate)
      const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value)
      const representedUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'))
      candidate = new Date(candidate.getTime() + intendedUtc - representedUtc)
    }
    const startedAt = Number(window.sessionStorage.getItem(ADMIN_TEST_TIME_STARTED_AT_STORAGE_KEY))
    return Number.isFinite(startedAt) && startedAt > 0
      ? new Date(candidate.getTime() + Math.max(0, Date.now() - startedAt))
      : candidate
  } catch {
    return new Date(year, month - 1, day, hour, minute)
  }
}

export function dateTimeInputInTimeZone(date: Date, timeZone: string | null | undefined) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
  } catch {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}
