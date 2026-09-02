import type { ThemeId } from './theme'

export type Profile = {
  id: string
  email: string
  weight_enabled: boolean
  target_weight: number | null
  desired_weight: number | null
  weight_started_on: string | null
  daily_calories_norm: number | null
  theme: ThemeId
  font_scale: number
}

export type Task = {
  id: string
  user_id: string
  title: string
  habit_days: number
  sort_order: number
}

export type TaskCompletion = {
  id: string
  task_id: string
  user_id: string
  completed_on: string
}

export type WeightLog = {
  id: string
  user_id: string
  value: number
  logged_on: string
}

export type CabinetTab = 'daily' | 'all' | 'calories' | 'training' | 'diary'

export type FoodLog = {
  id: string
  user_id: string
  logged_on: string
  product_name: string
  weight_grams: number
  calories_per_100g: number
}

export type SavedProduct = {
  id: string
  user_id: string
  name: string
  calories_per_100g: number
}

export type ExerciseCategory = 'Спина' | 'Грудь' | 'Плечи' | 'Руки' | 'Ноги' | 'Кор'
export type ExerciseType = 'Свободные веса / в блоке' | 'Собственный вес'

export type SavedExercise = {
  id: string
  user_id: string
  name: string
  category: ExerciseCategory
  exercise_type: ExerciseType
  rest_timer_enabled: boolean
}

export type ScheduledExercise = {
  id: string
  user_id: string
  planned_on: string
  exercise_name: string
  category: ExerciseCategory
  exercise_type: ExerciseType
  rest_timer_enabled: boolean
  sort_order: number
  weight_kg: number | null
  repetitions: number | null
  sets: number | null
  rest_duration: string | null
  parameters_locked: boolean
  completed: boolean
}
