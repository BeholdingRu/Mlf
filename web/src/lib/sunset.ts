export type SunsetCity = {
  name: string
  latitude: number
  longitude: number
}

export const TIME_ZONES = [
  { id: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { id: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { id: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { id: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { id: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { id: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { id: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { id: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { id: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { id: 'Asia/Kamchatka', label: 'Петропавловск-Камчатский (UTC+12)' },
] as const

export const SUNSET_CITIES: SunsetCity[] = [
  { name: 'Калининград', latitude: 54.7104, longitude: 20.4522 },
  { name: 'Москва', latitude: 55.7558, longitude: 37.6173 },
  { name: 'Санкт-Петербург', latitude: 59.9343, longitude: 30.3351 },
  { name: 'Воронеж', latitude: 51.6608, longitude: 39.2003 },
  { name: 'Ростов-на-Дону', latitude: 47.2357, longitude: 39.7015 },
  { name: 'Самара', latitude: 53.1959, longitude: 50.1002 },
  { name: 'Казань', latitude: 55.7963, longitude: 49.1088 },
  { name: 'Уфа', latitude: 54.7388, longitude: 55.9721 },
  { name: 'Екатеринбург', latitude: 56.8389, longitude: 60.6057 },
  { name: 'Челябинск', latitude: 55.1644, longitude: 61.4368 },
  { name: 'Омск', latitude: 54.9885, longitude: 73.3242 },
  { name: 'Новосибирск', latitude: 55.0084, longitude: 82.9357 },
  { name: 'Красноярск', latitude: 56.0153, longitude: 92.8932 },
  { name: 'Иркутск', latitude: 52.2864, longitude: 104.305 },
  { name: 'Якутск', latitude: 62.0355, longitude: 129.6755 },
  { name: 'Владивосток', latitude: 43.1155, longitude: 131.8855 },
  { name: 'Хабаровск', latitude: 48.4802, longitude: 135.0719 },
  { name: 'Магадан', latitude: 59.5612, longitude: 150.8301 },
  { name: 'Петропавловск-Камчатский', latitude: 53.037, longitude: 158.6559 },
]

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
