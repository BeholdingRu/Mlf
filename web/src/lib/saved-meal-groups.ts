import type { SavedMeal } from './types'

const LEGACY_COPY_IDENTIFIER_PATTERN = /^копия(?:\s+\d+)?$/iu

export function getMealGroupIdentifier(name: string): string | null {
  const match = name.match(/\(([^()]*)\)/u)
  const identifier = match?.[1].trim() ?? ''
  if (!identifier || LEGACY_COPY_IDENTIFIER_PATTERN.test(identifier)) return null
  return identifier
}

export function normalizeMealGroupIdentifier(identifier: string): string {
  return identifier.trim().toLocaleLowerCase('ru-RU')
}

export function getSavedMealGroupIds(meals: SavedMeal[]): string[][] {
  const groups = new Map<string, string[]>()
  meals.forEach((meal) => {
    const identifier = getMealGroupIdentifier(meal.name)
    if (identifier === null) return
    const normalizedIdentifier = normalizeMealGroupIdentifier(identifier)
    groups.set(normalizedIdentifier, [...(groups.get(normalizedIdentifier) ?? []), meal.id])
  })

  return [...groups.values()]
    .filter((mealIds) => mealIds.length > 1)
    .map((mealIds) => [...mealIds].sort())
    .sort((left, right) => left.join(':').localeCompare(right.join(':')))
}
