import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { requireSupabase } from '../lib/supabase'
import { localISODate } from '../lib/dates'
import type {
  ExerciseCategory,
  ExerciseType,
  FoodLog,
  Profile,
  ScheduledExercise,
  SavedExercise,
  SavedProduct,
  Task,
  TaskCompletion,
  WeightLog,
} from '../lib/types'
import { DEFAULT_PRODUCT_CATEGORY, type ProductCategory } from '../lib/product-categories'
import type { FontScale, ThemeId } from '../lib/theme'
import { isNutritionTask } from '../lib/nutrition-task'
import { useAuth } from './AuthContext'

type DataContextValue = {
  profile: Profile | null
  tasks: Task[]
  completions: TaskCompletion[]
  weightLogs: WeightLog[]
  foodLogs: FoodLog[]
  foodHistoryLogs: FoodLog[]
  savedProducts: SavedProduct[]
  savedExercises: SavedExercise[]
  scheduledExercises: ScheduledExercise[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  completeToday: (taskId: string) => Promise<void>
  addTask: (title: string, habitDays: number) => Promise<void>
  updateTask: (id: string, patch: { title?: string; habit_days?: number }) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  saveWeightSettings: (target: number | null) => Promise<void>
  saveWeightVisibility: (enabled: boolean) => Promise<void>
  logTodayWeight: (value: number) => Promise<void>
  saveCaloriesNorm: (norm: number | null) => Promise<void>
  saveDesiredWeight: (desired: number | null) => Promise<void>
  saveTheme: (theme: ThemeId) => Promise<void>
  saveFontScale: (scale: FontScale) => Promise<void>
  logFoodToday: (productName: string, weightGrams: number, caloriesPer100g: number) => Promise<void>
  deleteFoodLog: (id: string) => Promise<void>
  addSavedProduct: (
    name: string,
    caloriesPer100g: number,
    category: ProductCategory,
    isFavorite: boolean,
  ) => Promise<void>
  updateSavedProduct: (
    id: string,
    name: string,
    caloriesPer100g: number,
    category: ProductCategory,
    isFavorite: boolean,
  ) => Promise<void>
  setSavedProductFavorite: (id: string, isFavorite: boolean) => Promise<void>
  deleteSavedProduct: (id: string) => Promise<void>
  addSavedExercise: (
    name: string,
    category: ExerciseCategory,
    exerciseType: ExerciseType,
    restTimerEnabled: boolean,
  ) => Promise<void>
  updateSavedExercise: (
    id: string,
    name: string,
    exerciseType: ExerciseType,
    restTimerEnabled: boolean,
  ) => Promise<void>
  deleteSavedExercise: (id: string) => Promise<void>
  scheduleExercise: (plannedOn: string, exercise: SavedExercise) => Promise<void>
  deleteScheduledExercise: (id: string) => Promise<void>
  moveScheduledExercise: (id: string, direction: 'up' | 'down') => Promise<void>
  updateScheduledExercise: (
    id: string,
    patch: {
      weight_kg?: number | null
      repetitions?: number | null
      sets?: number | null
      rest_duration?: string | null
      parameters_locked?: boolean
      completed?: boolean
    },
  ) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [foodHistoryLogs, setFoodHistoryLogs] = useState<FoodLog[]>([])
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([])
  const [savedExercises, setSavedExercises] = useState<SavedExercise[]>([])
  const [scheduledExercises, setScheduledExercises] = useState<ScheduledExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    const client = requireSupabase()
    const today = localISODate()
    const [profileRes, tasksRes, completionsRes, weightRes, foodRes, foodHistoryRes, productsRes, exercisesRes, scheduledExercisesRes] = await Promise.all([
      client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      client.from('tasks').select('*').eq('user_id', user.id).order('sort_order'),
      client.from('task_completions').select('*').eq('user_id', user.id),
      client.from('weight_logs').select('*').eq('user_id', user.id).order('logged_on', {
        ascending: false,
      }),
      client.from('daily_food_logs').select('*').eq('user_id', user.id).eq('logged_on', today),
      client
        .from('daily_food_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_on', { ascending: false })
        .order('created_at'),
      client.from('saved_products').select('*').eq('user_id', user.id).order('name'),
      client.from('saved_exercises').select('*').eq('user_id', user.id).order('name'),
      client.from('scheduled_exercises').select('*').eq('user_id', user.id).order('planned_on').order('sort_order'),
    ])

    const firstError =
      profileRes.error?.message ||
      tasksRes.error?.message ||
      completionsRes.error?.message ||
      weightRes.error?.message ||
      foodRes.error?.message ||
      foodHistoryRes.error?.message ||
      productsRes.error?.message ||
      exercisesRes.error?.message ||
      scheduledExercisesRes.error?.message
    if (firstError) {
      setError(firstError)
      return
    }

    let nextProfile = profileRes.data as Profile | null
    if (!nextProfile) {
      const inserted = await client
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email ?? '',
        })
        .select('*')
        .single()
      if (inserted.error) {
        setError(inserted.error.message)
        return
      }
      nextProfile = inserted.data as Profile
    }

    setProfile(nextProfile)
    setTasks((tasksRes.data ?? []) as Task[])
    setCompletions((completionsRes.data ?? []) as TaskCompletion[])
    setWeightLogs((weightRes.data ?? []) as WeightLog[])
    setFoodLogs((foodRes.data ?? []) as FoodLog[])
    setFoodHistoryLogs((foodHistoryRes.data ?? []) as FoodLog[])
    setSavedProducts(
      ((productsRes.data ?? []) as SavedProduct[]).map((product) => ({
        ...product,
        category: product.category ?? DEFAULT_PRODUCT_CATEGORY,
        is_favorite: product.is_favorite ?? false,
      })),
    )
    setSavedExercises((exercisesRes.data ?? []) as SavedExercise[])
    setScheduledExercises((scheduledExercisesRes.data ?? []) as ScheduledExercise[])
    setError(null)
  }, [user])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setTasks([])
      setCompletions([])
      setWeightLogs([])
      setFoodLogs([])
      setFoodHistoryLogs([])
      setSavedProducts([])
      setSavedExercises([])
      setScheduledExercises([])
      setLoading(false)
      return
    }
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [user, refresh])

  useEffect(() => {
    if (!user) return

    let timeout: number
    const scheduleRefreshAtMidnight = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timeout = window.setTimeout(async () => {
        await refresh()
        scheduleRefreshAtMidnight()
      }, nextMidnight.getTime() - now.getTime())
    }

    scheduleRefreshAtMidnight()
    return () => window.clearTimeout(timeout)
  }, [user, refresh])

  useEffect(() => {
    if (!user || !profile?.weight_enabled || profile.daily_calories_norm == null) return

    const userId = user.id
    const nutritionTasks = tasks.filter(isNutritionTask)
    if (!nutritionTasks.length) return

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const previousDate = localISODate(yesterday)
    const totalCalories = foodHistoryLogs
      .filter((log) => log.logged_on === previousDate)
      .reduce((sum, log) => sum + (log.weight_grams / 100) * log.calories_per_100g, 0)

    if (totalCalories > profile.daily_calories_norm) return

    const incompleteTasks = nutritionTasks.filter(
      (task) => !completions.some(
        (completion) => completion.task_id === task.id && completion.completed_on === previousDate,
      ),
    )
    if (!incompleteTasks.length) return

    let cancelled = false

    async function completeNutritionTasks() {
      const client = requireSupabase()
      const results = await Promise.all(
        incompleteTasks.map((task) =>
          client
            .from('task_completions')
            .upsert(
              {
                task_id: task.id,
                user_id: userId,
                completed_on: previousDate,
              },
              { onConflict: 'task_id,completed_on' },
            )
            .select('*')
            .single(),
        ),
      )

      const failedResult = results.find((result) => result.error)
      if (failedResult?.error) {
        if (!cancelled) setError(failedResult.error.message)
        return
      }
      if (cancelled) return

      const automaticCompletions = results.map((result) => result.data as TaskCompletion)
      setCompletions((previous) => [
        ...previous.filter(
          (completion) => !automaticCompletions.some((automatic) => automatic.id === completion.id),
        ),
        ...automaticCompletions,
      ])
    }

    void completeNutritionTasks()
    return () => {
      cancelled = true
    }
  }, [user, profile, tasks, completions, foodHistoryLogs])

  const value = useMemo<DataContextValue>(
    () => ({
      profile,
      tasks,
      completions,
      weightLogs,
      foodLogs,
      foodHistoryLogs,
      savedProducts,
      savedExercises,
      scheduledExercises,
      loading,
      error,
      refresh,
      async completeToday(taskId) {
        if (!user) return
        const task = tasks.find((item) => item.id === taskId)
        if (profile?.weight_enabled && task && isNutritionTask(task)) {
          throw new Error('Эта задача отмечается автоматически по дневной норме калорий')
        }
        const today = localISODate()
        const existing = completions.find(
          (c) => c.task_id === taskId && c.completed_on === today,
        )
        if (existing) return
        const { data, error: insError } = await requireSupabase()
          .from('task_completions')
          .insert({
            task_id: taskId,
            user_id: user.id,
            completed_on: today,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setCompletions((prev) => [...prev, data as TaskCompletion])
      },
      async addTask(title, habitDays) {
        if (!user) return
        const { data, error: insError } = await requireSupabase()
          .from('tasks')
          .insert({
            user_id: user.id,
            title,
            habit_days: habitDays,
            sort_order: tasks.length,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setTasks((prev) => [...prev, data as Task])
      },
      async updateTask(id, patch) {
        const { data, error: updError } = await requireSupabase()
          .from('tasks')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        setTasks((prev) => prev.map((t) => (t.id === id ? (data as Task) : t)))
      },
      async deleteTask(id) {
        const { error: delError } = await requireSupabase().from('tasks').delete().eq('id', id)
        if (delError) throw delError
        setTasks((prev) => prev.filter((t) => t.id !== id))
        setCompletions((prev) => prev.filter((c) => c.task_id !== id))
      },
      async saveWeightSettings(target) {
        if (!user || !profile) return
        const started =
          profile.weight_started_on ??
          (target != null ? localISODate() : null)
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({
            target_weight: target,
            weight_started_on: started,
          })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveWeightVisibility(enabled) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({ weight_enabled: enabled })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async logTodayWeight(value) {
        if (!user) return
        const today = localISODate()
        const { data, error: upsertError } = await requireSupabase()
          .from('weight_logs')
          .upsert(
            {
              user_id: user.id,
              value,
              logged_on: today,
            },
            { onConflict: 'user_id,logged_on' },
          )
          .select('*')
          .single()
        if (upsertError) throw upsertError
        setWeightLogs((prev) => {
          const rest = prev.filter((w) => w.logged_on !== today)
          return [data as WeightLog, ...rest]
        })
      },
      async saveCaloriesNorm(norm) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({
            daily_calories_norm: norm,
          })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveDesiredWeight(desired) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({
            desired_weight: desired,
          })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveTheme(theme) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({ theme })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveFontScale(fontScale) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({ font_scale: fontScale })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async logFoodToday(productName, weightGrams, caloriesPer100g) {
        if (!user) return
        const today = localISODate()
        const { data, error: insError } = await requireSupabase()
          .from('daily_food_logs')
          .insert({
            user_id: user.id,
            logged_on: today,
            product_name: productName,
            weight_grams: weightGrams,
            calories_per_100g: caloriesPer100g,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setFoodLogs((prev) => [...prev, data as FoodLog])
        setFoodHistoryLogs((prev) => [...prev, data as FoodLog])
      },
      async deleteFoodLog(id) {
        const { error: delError } = await requireSupabase()
          .from('daily_food_logs')
          .delete()
          .eq('id', id)
        if (delError) throw delError
        setFoodLogs((prev) => prev.filter((f) => f.id !== id))
        setFoodHistoryLogs((prev) => prev.filter((f) => f.id !== id))
      },
      async addSavedProduct(name, caloriesPer100g, category, isFavorite) {
        if (!user) return
        const { data, error: insError } = await requireSupabase()
          .from('saved_products')
          .insert({
            user_id: user.id,
            name,
            calories_per_100g: caloriesPer100g,
            category,
            is_favorite: isFavorite,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setSavedProducts((prev) =>
          [...prev, data as SavedProduct].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
      },
      async updateSavedProduct(id, name, caloriesPer100g, category, isFavorite) {
        const { data, error: updError } = await requireSupabase()
          .from('saved_products')
          .update({
            name,
            calories_per_100g: caloriesPer100g,
            category,
            is_favorite: isFavorite,
          })
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        setSavedProducts((prev) =>
          prev.map((product) => (product.id === id ? (data as SavedProduct) : product))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
      },
      async setSavedProductFavorite(id, isFavorite) {
        const { data, error: updError } = await requireSupabase()
          .from('saved_products')
          .update({ is_favorite: isFavorite })
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        setSavedProducts((prev) =>
          prev.map((product) => (product.id === id ? (data as SavedProduct) : product)),
        )
      },
      async deleteSavedProduct(id) {
        const { error: delError } = await requireSupabase()
          .from('saved_products')
          .delete()
          .eq('id', id)
        if (delError) throw delError
        setSavedProducts((prev) => prev.filter((product) => product.id !== id))
      },
      async addSavedExercise(name, category, exerciseType, restTimerEnabled) {
        if (!user) return
        const { data, error: insError } = await requireSupabase()
          .from('saved_exercises')
          .insert({
            user_id: user.id,
            name,
            category,
            exercise_type: exerciseType,
            rest_timer_enabled: restTimerEnabled,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setSavedExercises((prev) =>
          [...prev, data as SavedExercise].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
      },
      async updateSavedExercise(id, name, exerciseType, restTimerEnabled) {
        const { data, error: updError } = await requireSupabase()
          .from('saved_exercises')
          .update({
            name,
            exercise_type: exerciseType,
            rest_timer_enabled: restTimerEnabled,
          })
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        setSavedExercises((prev) =>
          prev.map((exercise) => (exercise.id === id ? (data as SavedExercise) : exercise))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
      },
      async deleteSavedExercise(id) {
        const { error: delError } = await requireSupabase()
          .from('saved_exercises')
          .delete()
          .eq('id', id)
        if (delError) throw delError
        setSavedExercises((prev) => prev.filter((exercise) => exercise.id !== id))
      },
      async scheduleExercise(plannedOn, exercise) {
        if (!user) return
        const dayExercises = scheduledExercises.filter((item) => item.planned_on === plannedOn)
        const { data, error: insError } = await requireSupabase()
          .from('scheduled_exercises')
          .insert({
            user_id: user.id,
            planned_on: plannedOn,
            exercise_name: exercise.name,
            category: exercise.category,
            exercise_type: exercise.exercise_type,
            rest_timer_enabled: exercise.rest_timer_enabled,
            sort_order: dayExercises.length,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setScheduledExercises((prev) => [...prev, data as ScheduledExercise])
      },
      async deleteScheduledExercise(id) {
        const { error: delError } = await requireSupabase()
          .from('scheduled_exercises')
          .delete()
          .eq('id', id)
        if (delError) throw delError
        setScheduledExercises((prev) => prev.filter((exercise) => exercise.id !== id))
      },
      async moveScheduledExercise(id, direction) {
        const current = scheduledExercises.find((exercise) => exercise.id === id)
        if (!current) return
        const dayExercises = scheduledExercises
          .filter((exercise) => exercise.planned_on === current.planned_on)
          .sort((a, b) => a.sort_order - b.sort_order)
        const index = dayExercises.findIndex((exercise) => exercise.id === id)
        const target = dayExercises[index + (direction === 'up' ? -1 : 1)]
        if (!target) return

        const { error: firstError } = await requireSupabase()
          .from('scheduled_exercises')
          .update({ sort_order: target.sort_order })
          .eq('id', current.id)
        if (firstError) throw firstError
        const { error: secondError } = await requireSupabase()
          .from('scheduled_exercises')
          .update({ sort_order: current.sort_order })
          .eq('id', target.id)
        if (secondError) throw secondError
        setScheduledExercises((prev) => prev.map((exercise) => {
          if (exercise.id === current.id) return { ...exercise, sort_order: target.sort_order }
          if (exercise.id === target.id) return { ...exercise, sort_order: current.sort_order }
          return exercise
        }))
      },
      async updateScheduledExercise(id, patch) {
        const { data, error: updError } = await requireSupabase()
          .from('scheduled_exercises')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        setScheduledExercises((prev) =>
          prev.map((exercise) => (exercise.id === id ? (data as ScheduledExercise) : exercise)),
        )
      },
    }),
    [
      profile,
      tasks,
      completions,
      weightLogs,
      foodLogs,
      foodHistoryLogs,
      savedProducts,
      savedExercises,
      scheduledExercises,
      loading,
      error,
      refresh,
      user,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
