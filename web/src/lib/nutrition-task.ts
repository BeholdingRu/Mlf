import type { Task } from './types'

const nutritionTaskTitle = 'Телостроительство:Питание'

export function isNutritionTask(task: Task) {
  return task.title.trim() === nutritionTaskTitle
}
