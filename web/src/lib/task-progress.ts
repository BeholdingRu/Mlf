import { daysInclusive, isoDateInTimeZone, localISODate, parseISODate } from './dates'
import { normalizeTaskInvertedLogicHistory } from './task-inverted-logic-history'
import type { Task, TaskCompletion } from './types'

export function getRegularTaskProgress(
  task: Task,
  completions: TaskCompletion[],
  today = localISODate(),
  timeZone?: string | null,
) {
  const createdOn = isoDateInTimeZone(timeZone, new Date(task.created_at))
  if (today < createdOn) return { progressDays: 0, successfulDays: 0, missedDays: 0, missedDates: [] as string[] }

  const completedDates = new Set(
    completions
      .filter((completion) => (
        completion.task_id === task.id
        && completion.progress_neutral !== true
        && completion.completed_on >= createdOn
        && completion.completed_on <= today
      ))
      .map((completion) => completion.completed_on),
  )
  const neutralDates = new Set(
    completions
      .filter((completion) => (
        completion.task_id === task.id
        && completion.progress_neutral === true
        && completion.completed_on >= createdOn
        && completion.completed_on <= today
      ))
      .map((completion) => completion.completed_on),
  )
  const cursor = parseISODate(createdOn)
  const lastDate = parseISODate(today)
  const invertedLogicHistory = normalizeTaskInvertedLogicHistory(
    task.inverted_logic_history,
    task.inverted_logic,
    today,
  )
  let historyIndex = 0
  let invertedOnDate = false
  let progressDays = 0
  let successfulDays = 0
  let missedDays = 0
  const missedDates: string[] = []

  while (cursor <= lastDate) {
    const date = localISODate(cursor)
    while (
      historyIndex < invertedLogicHistory.length
      && invertedLogicHistory[historyIndex].effective_on <= date
    ) {
      invertedOnDate = invertedLogicHistory[historyIndex].inverted_logic
      historyIndex += 1
    }
    const marked = completedDates.has(date)
    if (neutralDates.has(date)) {
      // A neutral day neither advances nor reduces task progress.
    } else if (invertedOnDate) {
      if (marked) {
        missedDays += 1
        missedDates.push(date)
        progressDays = Math.max(0, progressDays - 1)
      } else if (date < today) {
        successfulDays += 1
        progressDays += 1
      }
    } else if (marked) {
      successfulDays += 1
      progressDays += 1
    } else if (date < today) {
      missedDays += 1
      missedDates.push(date)
      progressDays = Math.max(0, progressDays - 1)
    }

    if (progressDays >= task.habit_days) {
      return { progressDays: task.habit_days, successfulDays, missedDays, missedDates }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return { progressDays, successfulDays, missedDays, missedDates }
}

export function getRegularTaskProgressDays(
  task: Task,
  completions: TaskCompletion[],
  today = localISODate(),
  timeZone?: string | null,
) {
  return getRegularTaskProgress(task, completions, today, timeZone).progressDays
}

/**
 * Progress for a task whose duration runs by calendar days rather than by
 * completed marks. A countdown is selected only when the task is created,
 * so its immutable creation date is the beginning of the interval.
 */
export function getCountdownTaskProgress(
  task: Task,
  completions: TaskCompletion[],
  today = localISODate(),
  timeZone?: string | null,
) {
  const startedOn = isoDateInTimeZone(timeZone, new Date(task.created_at))
  const durationDays = Math.max(1, task.habit_days)
  const startedAt = parseISODate(startedOn)
  const endsAt = new Date(startedAt)
  endsAt.setDate(endsAt.getDate() + durationDays - 1)
  const endsOn = localISODate(endsAt)

  if (today < startedOn) {
    return {
      progressDays: 0,
      remainingDays: durationDays,
      successfulDays: 0,
      missedDays: 0,
      missedDates: [] as string[],
      finished: false,
    }
  }

  const elapsedDays = Math.min(
    durationDays,
    Math.max(0, daysInclusive(startedAt, parseISODate(today)) - 1),
  )
  const completedDates = new Set(
    completions
      .filter((completion) => (
        completion.task_id === task.id
        && completion.progress_neutral !== true
        && completion.completed_on >= startedOn
        && completion.completed_on <= endsOn
        && completion.completed_on <= today
      ))
      .map((completion) => completion.completed_on),
  )
  const missedDates: string[] = []
  const cursor = new Date(startedAt)

  // The current day is not missed until it has actually ended. Once the
  // countdown reaches zero, all active days have become past days.
  while (localISODate(cursor) < today && cursor <= endsAt) {
    const date = localISODate(cursor)
    if (!completedDates.has(date)) missedDates.push(date)
    cursor.setDate(cursor.getDate() + 1)
  }

  return {
    progressDays: elapsedDays,
    remainingDays: durationDays - elapsedDays,
    successfulDays: completedDates.size,
    missedDays: missedDates.length,
    missedDates,
    finished: elapsedDays >= durationDays,
  }
}

export function russianDays(count: number) {
  const absoluteCount = Math.abs(count)
  const mod10 = absoluteCount % 10
  const mod100 = absoluteCount % 100
  const word = mod10 === 1 && mod100 !== 11
    ? 'день'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? 'дня'
      : 'дней'
  return `${count} ${word}`
}

export function russianMissedDays(count: number) {
  const singular = Math.abs(count) % 10 === 1 && Math.abs(count) % 100 !== 11
  return `${russianDays(count)} ${singular ? 'пропущен' : 'пропущено'}`
}
