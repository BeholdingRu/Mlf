export type Profile = {
  id: string
  email: string
  weight_enabled: boolean
  target_weight: number | null
  desired_weight: number | null
  weight_started_on: string | null
  daily_calories_norm: number | null
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

export type CabinetTab = 'daily' | 'week' | 'month' | 'all' | 'calories' | 'diary'

export type FoodLog = {
  id: string
  user_id: string
  logged_on: string
  product_name: string
  weight_grams: number
  calories_per_100g: number
}
