export const NUTRITION_TASK_TITLE = 'Телостроительство:Питание'

const normalizedNutritionTaskTitle = NUTRITION_TASK_TITLE.toLocaleLowerCase('ru-RU')

export function isNutritionTask(task: {
  title: string
  task_kind?: string | null
  withdrawal_syndrome?: boolean
}) {
  if (task.withdrawal_syndrome) return false
  if (task.task_kind) return task.task_kind === 'nutrition'

  const normalizedTitle = task.title
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/\s*:\s*/g, ':')
  return normalizedTitle === normalizedNutritionTaskTitle
}
