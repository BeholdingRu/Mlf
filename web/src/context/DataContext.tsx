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
import type { FoodLog, Profile, SavedProduct, Task, TaskCompletion, WeightLog } from '../lib/types'
import { useAuth } from './AuthContext'

type DataContextValue = {
  profile: Profile | null
  tasks: Task[]
  completions: TaskCompletion[]
  weightLogs: WeightLog[]
  foodLogs: FoodLog[]
  foodHistoryLogs: FoodLog[]
  savedProducts: SavedProduct[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  completeToday: (taskId: string) => Promise<void>
  addTask: (title: string, habitDays: number) => Promise<void>
  updateTask: (id: string, patch: { title?: string; habit_days?: number }) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  saveWeightSettings: (enabled: boolean, target: number | null) => Promise<void>
  logTodayWeight: (value: number) => Promise<void>
  saveCaloriesNorm: (norm: number | null) => Promise<void>
  saveDesiredWeight: (desired: number | null) => Promise<void>
  logFoodToday: (productName: string, weightGrams: number, caloriesPer100g: number) => Promise<void>
  deleteFoodLog: (id: string) => Promise<void>
  addSavedProduct: (name: string, caloriesPer100g: number) => Promise<void>
  deleteSavedProduct: (id: string) => Promise<void>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    const client = requireSupabase()
    const today = localISODate()
    const [profileRes, tasksRes, completionsRes, weightRes, foodRes, foodHistoryRes, productsRes] = await Promise.all([
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
    ])

    const firstError =
      profileRes.error?.message ||
      tasksRes.error?.message ||
      completionsRes.error?.message ||
      weightRes.error?.message ||
      foodRes.error?.message ||
      foodHistoryRes.error?.message ||
      productsRes.error?.message
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
    setSavedProducts((productsRes.data ?? []) as SavedProduct[])
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

  const value = useMemo<DataContextValue>(
    () => ({
      profile,
      tasks,
      completions,
      weightLogs,
      foodLogs,
      foodHistoryLogs,
      savedProducts,
      loading,
      error,
      refresh,
      async completeToday(taskId) {
        if (!user) return
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
      async saveWeightSettings(enabled, target) {
        if (!user || !profile) return
        const started =
          profile.weight_started_on ??
          (target != null ? localISODate() : null)
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({
            weight_enabled: enabled,
            target_weight: target,
            weight_started_on: started,
          })
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
      async addSavedProduct(name, caloriesPer100g) {
        if (!user) return
        const { data, error: insError } = await requireSupabase()
          .from('saved_products')
          .insert({
            user_id: user.id,
            name,
            calories_per_100g: caloriesPer100g,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setSavedProducts((prev) =>
          [...prev, data as SavedProduct].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
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
    }),
    [
      profile,
      tasks,
      completions,
      weightLogs,
      foodLogs,
      foodHistoryLogs,
      savedProducts,
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
