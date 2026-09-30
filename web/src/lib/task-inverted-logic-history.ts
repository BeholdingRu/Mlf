import { localISODate } from './dates'
import type { TaskInvertedLogicHistoryEntry } from './types'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function normalizeTaskInvertedLogicHistory(
  value: unknown,
  currentInvertedLogic = false,
  effectiveOn = localISODate(),
): TaskInvertedLogicHistoryEntry[] {
  const entriesByDate = new Map<string, TaskInvertedLogicHistoryEntry>()

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return
      const candidate = entry as Partial<TaskInvertedLogicHistoryEntry>
      if (
        typeof candidate.effective_on !== 'string'
        || !ISO_DATE_PATTERN.test(candidate.effective_on)
        || typeof candidate.inverted_logic !== 'boolean'
      ) return

      entriesByDate.set(candidate.effective_on, {
        effective_on: candidate.effective_on,
        inverted_logic: candidate.inverted_logic,
      })
    })
  }

  const history = [...entriesByDate.values()]
    .sort((left, right) => left.effective_on.localeCompare(right.effective_on))

  // Before the history field existed, tasks were regular. If an old task is
  // currently inverted, consider the current day its first known switch date.
  if (!history.length && currentInvertedLogic) {
    return [{ effective_on: effectiveOn, inverted_logic: true }]
  }

  return history
}

export function recordTaskInvertedLogicChange(
  history: TaskInvertedLogicHistoryEntry[],
  invertedLogic: boolean,
  effectiveOn = localISODate(),
) {
  return normalizeTaskInvertedLogicHistory([
    ...history.filter((entry) => entry.effective_on !== effectiveOn),
    { effective_on: effectiveOn, inverted_logic: invertedLogic },
  ])
}
