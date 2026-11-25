import type { Task } from './types'

export const MAX_TASK_SEPARATORS = 5
const TASK_SEPARATOR_PATTERN = /^__mlf_task_separator_([1-5])__$/

export function getTaskSeparatorNumber(task: Pick<Task, 'title'>): number | null {
  const match = TASK_SEPARATOR_PATTERN.exec(task.title)
  return match ? Number(match[1]) : null
}

export function isTaskSeparator(task: Pick<Task, 'title'>): boolean {
  return getTaskSeparatorNumber(task) !== null
}

export function isReservedTaskSeparatorTitle(title: string): boolean {
  return title.trim().toLocaleLowerCase('en-US').startsWith('__mlf_task_separator_')
}

export function getTaskSeparatorTitle(number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > MAX_TASK_SEPARATORS) {
    throw new Error('Номер разделителя должен быть от 1 до 5')
  }
  return `__mlf_task_separator_${number}__`
}

export function getAvailableTaskSeparatorNumber(tasks: readonly Pick<Task, 'title'>[]): number | null {
  const usedNumbers = new Set(tasks.map(getTaskSeparatorNumber))
  for (let number = 1; number <= MAX_TASK_SEPARATORS; number += 1) {
    if (!usedNumbers.has(number)) return number
  }
  return null
}
