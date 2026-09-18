import type { Task } from './types'

const nutritionTaskTitle = 'телостроительство:питание'

export function isNutritionTask(task: Task) {
  const normalizedTitle = task.title
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/\s*:\s*/g, ':')
  return normalizedTitle === nutritionTaskTitle
}
