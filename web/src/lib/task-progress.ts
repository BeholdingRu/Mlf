import { isoDateInTimeZone, localISODate, parseISODate } from './dates'
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
    if (invertedOnDate) {
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
