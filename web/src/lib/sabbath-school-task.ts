import type { PathDay } from './types'
import { isoDateInTimeZone } from './dates'

const SABBATH_SCHOOL_TITLE_PATTERN = /(?:^|[^\p{L}\p{N}_])субботн(?:яя|ей|ею|юю|ие|их|им|ими)\s+школ(?:а|ы|е|у|ой|ою|ам|ами|ах)(?:$|[^\p{L}\p{N}_])/iu

const PATH_DAY_OFFSETS: Record<PathDay, number> = {
  saturday: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
}

export function getSabbathSchoolCycleStart(
  timeZone: string | null | undefined,
  now = new Date(),
) {
  const localDate = isoDateInTimeZone(timeZone, now)
  const cycleStart = new Date(`${localDate}T00:00:00.000Z`)
  if (Number.isNaN(cycleStart.getTime())) return null

  cycleStart.setUTCDate(cycleStart.getUTCDate() - cycleStart.getUTCDay())
  return cycleStart.toISOString().slice(0, 10)
}

export function isSabbathSchoolTask(task: {
  title: string
  withdrawal_syndrome?: boolean
}) {
  return !task.withdrawal_syndrome && SABBATH_SCHOOL_TITLE_PATTERN.test(task.title)
}

export function getPathDayCompletionDate(cycleStartedOn: string, day: PathDay) {
  const cycleStart = new Date(`${cycleStartedOn}T00:00:00.000Z`)
  if (Number.isNaN(cycleStart.getTime())) return null

  cycleStart.setUTCDate(cycleStart.getUTCDate() + PATH_DAY_OFFSETS[day])
  return cycleStart.toISOString().slice(0, 10)
}
