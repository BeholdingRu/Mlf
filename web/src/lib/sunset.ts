export type SunsetCity = {
  name: string
  latitude: number
  longitude: number
}

export type TimeZoneOption = {
  id: string
  label: string
  city: SunsetCity
}

export const DEFAULT_TIME_ZONE = 'Europe/Moscow'

export const TIME_ZONES = [
  { id: 'Europe/Kaliningrad', label: 'UTC+2 — Калининград', city: { name: 'Калининград', latitude: 54.7104, longitude: 20.4522 } },
  { id: 'Europe/Moscow', label: 'UTC+3 — Москва', city: { name: 'Москва', latitude: 55.7558, longitude: 37.6173 } },
  { id: 'Europe/Samara', label: 'UTC+4 — Самара', city: { name: 'Самара', latitude: 53.1959, longitude: 50.1002 } },
  { id: 'Asia/Yekaterinburg', label: 'UTC+5 — Екатеринбург', city: { name: 'Екатеринбург', latitude: 56.8389, longitude: 60.6057 } },
  { id: 'Asia/Omsk', label: 'UTC+6 — Омск', city: { name: 'Омск', latitude: 54.9885, longitude: 73.3242 } },
  { id: 'Asia/Krasnoyarsk', label: 'UTC+7 — Красноярск', city: { name: 'Красноярск', latitude: 56.0153, longitude: 92.8932 } },
  { id: 'Asia/Irkutsk', label: 'UTC+8 — Иркутск', city: { name: 'Иркутск', latitude: 52.2864, longitude: 104.305 } },
  { id: 'Asia/Yakutsk', label: 'UTC+9 — Якутск', city: { name: 'Якутск', latitude: 62.0355, longitude: 129.6755 } },
  { id: 'Asia/Vladivostok', label: 'UTC+10 — Владивосток', city: { name: 'Владивосток', latitude: 43.1155, longitude: 131.8855 } },
  { id: 'Asia/Magadan', label: 'UTC+11 — Магадан', city: { name: 'Магадан', latitude: 59.5612, longitude: 150.8301 } },
  { id: 'Asia/Kamchatka', label: 'UTC+12 — Петропавловск-Камчатский', city: { name: 'Петропавловск-Камчатский', latitude: 53.037, longitude: 158.6559 } },
] satisfies readonly TimeZoneOption[]

const defaultTimeZoneOption = TIME_ZONES.find((option) => option.id === DEFAULT_TIME_ZONE)!

export function getTimeZoneOption(timeZone: string | null | undefined): TimeZoneOption {
  return TIME_ZONES.find((option) => option.id === timeZone) ?? defaultTimeZoneOption
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function dayOfYear(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000)
}

export function getSunsetTime(isoDate: string, latitude: number, longitude: number, timeZone: string): string | null {
  const [year, month, day] = isoDate.split('-').map(Number)
  const dayNumber = dayOfYear(isoDate)
  const longitudeHour = longitude / 15
  const approximateTime = dayNumber + (18 - longitudeHour) / 24
  const meanAnomaly = 0.9856 * approximateTime - 3.289
  const trueLongitude = normalizeDegrees(
    meanAnomaly
      + 1.916 * Math.sin(degreesToRadians(meanAnomaly))
      + 0.02 * Math.sin(degreesToRadians(2 * meanAnomaly))
      + 282.634,
  )
  let rightAscension = normalizeDegrees(radiansToDegrees(Math.atan(0.91764 * Math.tan(degreesToRadians(trueLongitude)))))
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90
  rightAscension /= 15

  const sinDeclination = 0.39782 * Math.sin(degreesToRadians(trueLongitude))
  const cosDeclination = Math.cos(Math.asin(sinDeclination))
  const cosHourAngle = (
    Math.cos(degreesToRadians(90.833))
    - sinDeclination * Math.sin(degreesToRadians(latitude))
  ) / (cosDeclination * Math.cos(degreesToRadians(latitude)))
  if (cosHourAngle > 1 || cosHourAngle < -1) return null

  const hourAngle = radiansToDegrees(Math.acos(cosHourAngle)) / 15
  const universalTime = ((hourAngle + rightAscension - 0.06571 * approximateTime - 6.622 - longitudeHour) % 24 + 24) % 24
  const sunset = new Date(Date.UTC(year, month - 1, day) + universalTime * 3_600_000)

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(sunset)
}
