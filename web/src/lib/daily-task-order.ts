import { isBibleReadingTask } from './bible-books'
import { isNutritionTask } from './nutrition-task'
import type { Task } from './types'

export function getRegularTaskDisplayPriority(
  task: Task,
  automaticNutritionEnabled: boolean,
) {
  if (task.inverted_logic) return 1
  if (isBibleReadingTask(task) || (automaticNutritionEnabled && isNutritionTask(task))) return 2
  return 0
}

export function compareRegularTasksForDisplay(
  first: Task,
  second: Task,
  automaticNutritionEnabled: boolean,
) {
  return getRegularTaskDisplayPriority(first, automaticNutritionEnabled)
    - getRegularTaskDisplayPriority(second, automaticNutritionEnabled)
    || first.sort_order - second.sort_order
    || first.created_at.localeCompare(second.created_at)
    || first.id.localeCompare(second.id)
}
