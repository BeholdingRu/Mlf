import { getSunsetTime } from './sunset'
import type { Profile } from './types'

function getDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
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
}

function isoDate({ year, month, day }: ReturnType<typeof getDateTimeParts>) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function minutes(time: string | null) {
  if (!time) return null
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function isShabbatActive(profile: Profile | null, now = new Date()) {
  if (!profile?.time_zone || profile.city_latitude === null || profile.city_longitude === null) return false

  const localNow = getDateTimeParts(now, profile.time_zone)
  const weekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay()
  const currentMinutes = localNow.hour * 60 + localNow.minute
  const today = isoDate(localNow)
  const sunset = minutes(getSunsetTime(today, profile.city_latitude, profile.city_longitude, profile.time_zone))
  if (sunset === null) return false

  return (weekday === 5 && currentMinutes >= sunset) || (weekday === 6 && currentMinutes < sunset)
}

export function getFridaySunsetCountdownSeconds(profile: Profile | null, now = new Date()) {
  if (!profile?.time_zone || profile.city_latitude === null || profile.city_longitude === null) return null

  const localNow = getDateTimeParts(now, profile.time_zone)
  const weekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay()
  if (weekday !== 5) return null

  const sunset = minutes(getSunsetTime(
    isoDate(localNow),
    profile.city_latitude,
    profile.city_longitude,
    profile.time_zone,
  ))
  if (sunset === null) return null

  const currentSeconds = localNow.hour * 3_600 + localNow.minute * 60 + localNow.second + now.getMilliseconds() / 1_000
  const secondsUntilSunset = Math.ceil(sunset * 60 - currentSeconds)
  return secondsUntilSunset > 0 && secondsUntilSunset <= 3_600 ? secondsUntilSunset : null
}

export function getShabbatWeekStart(profile: Profile | null, now = new Date()) {
  if (!profile?.time_zone || profile.city_latitude === null || profile.city_longitude === null) return null

  const localNow = getDateTimeParts(now, profile.time_zone)
  const weekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay()
  const currentMinutes = localNow.hour * 60 + localNow.minute
  const today = isoDate(localNow)
  const sunset = minutes(getSunsetTime(today, profile.city_latitude, profile.city_longitude, profile.time_zone))
  if (sunset === null) return null

  const daysSinceFriday = weekday === 5 && currentMinutes < sunset ? 7 : (weekday + 2) % 7
  const cycleStart = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day))
  cycleStart.setUTCDate(cycleStart.getUTCDate() - daysSinceFriday)
  return cycleStart.toISOString().slice(0, 10)
}
