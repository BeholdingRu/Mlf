const nutritionTaskTitle = 'телостроительство:питание'

export function isNutritionTask(task: { title: string }) {
  const normalizedTitle = task.title
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/\s*:\s*/g, ':')
  return normalizedTitle === nutritionTaskTitle
}
