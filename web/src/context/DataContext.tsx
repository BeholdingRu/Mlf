import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { requireSupabase } from '../lib/supabase'
import {
  isoDateInTimeZone,
  localISODate,
  millisecondsUntilNextDayInTimeZone,
  parseISODate,
} from '../lib/dates'
import type {
  FoodLog,
  BibleBookmark,
  BibleTreeProgress,
  BibleVerse,
  CourseLessonCompletion,
  MindfulnessCategory,
  MindfulnessNote,
  PathDayConfirmation,
  Profile,
  ScheduledExercise,
  SavedExercise,
  SavedMeal,
  SavedMealItem,
  SavedMealPlan,
  SavedProduct,
  Task,
  TaskCompletion,
  TorahPortion,
  WeightLog,
} from '../lib/types'
import { DEFAULT_PRODUCT_CATEGORY } from '../lib/product-categories'
import { isNutritionTask } from '../lib/nutrition-task'
import { getCalorieAdaptation } from '../lib/calorie-adaptation'
import { isBibleReadingTask } from '../lib/bible-books'
import {
  getBibleDailyReadingCount,
  seedBibleDailyReadingChapters,
  subscribeBibleDailyReading,
} from '../lib/bible-daily-reading'
import { useAuth } from '../hooks/useAuth'
import { DataContext, type DataContextValue } from './data-context'
import { BIBLE_GROWTH_TOTAL_STEPS } from '../lib/bible-growth'
import {
  normalizeTaskInvertedLogicHistory,
  recordTaskInvertedLogicChange,
} from '../lib/task-inverted-logic-history'

const ADMIN_MODE_STORAGE_KEY = 'mlf:admin-mode'
const DATA_LOAD_TIMEOUT_MS = 20_000
const BIBLE_SERVER_DAILY_CHAPTER_LIMIT = 5
const SAVED_MEAL_NAME_MAX_LENGTH = 120
const SAVED_MEAL_ITEMS_MAX_COUNT = 100
const EMPTY_BIBLE_TREE_PROGRESS: BibleTreeProgress = {
  progressSteps: 0,
  chaptersToday: 0,
  startedOn: null,
  available: false,
}

type BibleTreeProgressRpcRow = {
  progress_steps: number
  chapters_today: number
  started_on: string | null
}

type CalorieNormHistoryRow = {
  user_id: string
  effective_on: string
  daily_calories_norm: number | null
  daily_calories_norm_override?: number | null
  calorie_adaptation_enabled: boolean
  calorie_adaptation_baseline_weight: number | null
  calorie_adaptation_baseline_on: string | null
}

function isCalorieNormHistoryMissing(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || error?.message?.includes('relation "public.calorie_norm_history" does not exist') === true
    || error?.message?.includes("Could not find the table 'public.calorie_norm_history'") === true
}

function isSavedMealsFeatureMissing(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || error?.message?.includes('relation "public.saved_meals" does not exist') === true
    || error?.message?.includes("Could not find the table 'public.saved_meals'") === true
}

function isSavedMealPlansFeatureMissing(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || error?.message?.includes('saved_meal_plans') === true
}

function normalizeSavedMealItems(items: unknown): SavedMealItem[] {
  if (!Array.isArray(items)) return []

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const candidate = item as Partial<SavedMealItem>
    const savedProductId = typeof candidate.saved_product_id === 'string'
      ? candidate.saved_product_id.trim()
      : ''
    const weightGrams = Number(candidate.weight_grams)

    if (
      !savedProductId
      || !Number.isFinite(weightGrams)
      || weightGrams <= 0
    ) {
      return []
    }

    return [{
      saved_product_id: savedProductId,
      weight_grams: weightGrams,
    }]
  })
}

function normalizeSavedMeal(meal: SavedMeal): SavedMeal | null {
  const name = typeof meal.name === 'string' ? meal.name.trim() : ''
  const items = normalizeSavedMealItems(meal.items)
  if (!name || items.length === 0) return null
  return { ...meal, name, items }
}

function isBibleTreeFeatureMissing(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST202'
    || error?.code === '42883'
    || error?.code === '42P01'
    || error?.message?.includes('refresh_bible_tree_progress') === true
    || error?.message?.includes('record_bible_chapter_read') === true
}

function normalizeBibleTreeProgress(data: unknown): BibleTreeProgress {
  const result = Array.isArray(data) ? data[0] : data
  const row = result as BibleTreeProgressRpcRow | null | undefined
  return {
    progressSteps: Math.max(0, Math.min(BIBLE_GROWTH_TOTAL_STEPS, Number(row?.progress_steps) || 0)),
    chaptersToday: Math.max(0, Math.min(5, Number(row?.chapters_today) || 0)),
    startedOn: row?.started_on ?? null,
    available: true,
  }
}

async function withDataLoadTimeout<T>(request: PromiseLike<T>): Promise<T> {
  let timeoutId: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('Не удалось загрузить данные. Проверьте подключение к интернету и обновите страницу.'))
    }, DATA_LOAD_TIMEOUT_MS)
  })

  try {
    return await Promise.race([request, timeout])
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId)
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const userEmail = user?.email ?? ''
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [foodHistoryLogs, setFoodHistoryLogs] = useState<FoodLog[]>([])
  const [bibleBookmarks, setBibleBookmarks] = useState<BibleBookmark[]>([])
  const [bibleTreeProgress, setBibleTreeProgress] = useState<BibleTreeProgress>(EMPTY_BIBLE_TREE_PROGRESS)
  const [bibleTreeProgressDate, setBibleTreeProgressDate] = useState<string | null>(null)
  const [bibleReadingVerifiedDate, setBibleReadingVerifiedDate] = useState<string | null>(null)
  const [bibleReadingDate, setBibleReadingDate] = useState(() => isoDateInTimeZone(undefined))
  const [bibleDailyReading, setBibleDailyReading] = useState<{
    userId: string | null
    date: string
    count: number
  }>(() => ({ userId: null, date: isoDateInTimeZone(undefined), count: 0 }))
  const [pathDayConfirmations, setPathDayConfirmations] = useState<PathDayConfirmation[]>([])
  const [courseLessonCompletions, setCourseLessonCompletions] = useState<CourseLessonCompletion[]>([])
  const [mindfulnessCategories, setMindfulnessCategories] = useState<MindfulnessCategory[]>([])
  const [mindfulnessNotes, setMindfulnessNotes] = useState<MindfulnessNote[]>([])
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [savedMealPlans, setSavedMealPlans] = useState<SavedMealPlan[]>([])
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([])
  const [savedExercises, setSavedExercises] = useState<SavedExercise[]>([])
  const [scheduledExercises, setScheduledExercises] = useState<ScheduledExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMode, setAdminModeEnabled] = useState(
    () => window.sessionStorage.getItem(ADMIN_MODE_STORAGE_KEY) === 'true',
  )
  const bibleCompletionPendingRef = useRef(new Set<string>())
  const nutritionReconciliationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const nutritionCatchUpSignatureRef = useRef<string | null>(null)
  const bibleChaptersReadToday = bibleDailyReading.userId === (userId ?? null)
    && bibleDailyReading.date === bibleReadingDate
    ? bibleDailyReading.count
    : 0

  const setAdminMode = useCallback((enabled: boolean) => {
    if (!isAdmin) return

    setAdminModeEnabled(enabled)
    if (enabled) {
      window.sessionStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'true')
    } else {
      window.sessionStorage.removeItem(ADMIN_MODE_STORAGE_KEY)
    }
  }, [isAdmin])

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const client = requireSupabase()
    let responses
    try {
      responses = await withDataLoadTimeout(Promise.all([
        client.from('profiles').select('*').eq('id', userId).maybeSingle(),
        client.from('tasks').select('*').eq('user_id', userId).order('sort_order'),
        client.from('task_completions').select('*').eq('user_id', userId),
        client.from('weight_logs').select('*').eq('user_id', userId).order('logged_on', {
          ascending: false,
        }),
        client
          .from('daily_food_logs')
          .select('*')
          .eq('user_id', userId)
          .order('logged_on', { ascending: false })
          .order('created_at'),
        client.from('saved_products').select('*').eq('user_id', userId).order('name'),
        client.from('saved_meals').select('*').eq('user_id', userId).order('created_at'),
        client.from('saved_meal_plans').select('*').eq('user_id', userId).order('planned_on'),
        client.from('saved_exercises').select('*').eq('user_id', userId).order('name'),
        client.from('scheduled_exercises').select('*').eq('user_id', userId).order('planned_on').order('sort_order'),
        client.from('path_day_confirmations').select('*').eq('user_id', userId),
        client.from('course_lesson_completions').select('*').eq('user_id', userId),
        client.from('mindfulness_categories').select('*').eq('user_id', userId).order('created_at'),
        client.from('mindfulness_notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
        client.from('bible_bookmarks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить данны кабинета')
      setLoading(false)
      return
    }
    const [profileRes, tasksRes, completionsRes, weightRes, foodHistoryRes, productsRes, mealsRes, mealPlansRes, exercisesRes, scheduledExercisesRes, pathConfirmationsRes, courseLessonsRes, mindfulnessCategoriesRes, mindfulnessNotesRes, bibleBookmarksRes] = responses

    const bookmarksTableMissing = bibleBookmarksRes.error?.code === '42P01'
      || bibleBookmarksRes.error?.code === 'PGRST205'
    const savedMealsTableMissing = isSavedMealsFeatureMissing(mealsRes.error)
    const savedMealPlansTableMissing = isSavedMealPlansFeatureMissing(mealPlansRes.error)

    const firstError =
      profileRes.error?.message ||
      tasksRes.error?.message ||
      completionsRes.error?.message ||
      weightRes.error?.message ||
      foodHistoryRes.error?.message ||
      productsRes.error?.message ||
      (!savedMealsTableMissing && mealsRes.error?.message) ||
      (!savedMealPlansTableMissing && mealPlansRes.error?.message) ||
      exercisesRes.error?.message ||
      scheduledExercisesRes.error?.message ||
      pathConfirmationsRes.error?.message ||
      courseLessonsRes.error?.message ||
      mindfulnessCategoriesRes.error?.message ||
      mindfulnessNotesRes.error?.message ||
      (!bookmarksTableMissing && bibleBookmarksRes.error?.message)
    if (firstError) {
      setError(firstError)
      setLoading(false)
      return
    }

    let nextProfile = profileRes.data as Profile | null
    if (!nextProfile) {
      const inserted = await withDataLoadTimeout(
        client
          .from('profiles')
          .upsert({
            id: userId,
            email: userEmail,
          })
          .select('*')
          .single(),
      )
      if (inserted.error) {
        setError(inserted.error.message)
        setLoading(false)
        return
      }
      nextProfile = inserted.data as Profile
    }

    const taskHistoryEffectiveOn = isoDateInTimeZone(nextProfile.time_zone)
    setBibleReadingVerifiedDate((currentDate) => (
      currentDate === taskHistoryEffectiveOn ? currentDate : null
    ))
    setBibleReadingDate(taskHistoryEffectiveOn)
    setBibleDailyReading({
      userId,
      date: taskHistoryEffectiveOn,
      count: getBibleDailyReadingCount(userId, taskHistoryEffectiveOn),
    })
    setProfile(nextProfile)
    setTasks(((tasksRes.data ?? []) as Task[]).map((task) => ({
      ...task,
      task_kind: task.task_kind ?? null,
      bible_daily_chapter_target: task.bible_daily_chapter_target ?? null,
      inverted_logic: task.inverted_logic ?? false,
      inverted_logic_history: normalizeTaskInvertedLogicHistory(
        task.inverted_logic_history,
        task.inverted_logic ?? false,
        taskHistoryEffectiveOn,
      ),
    })))
    setCompletions((completionsRes.data ?? []) as TaskCompletion[])
    setWeightLogs((weightRes.data ?? []) as WeightLog[])
    const normalizedSavedProducts = ((productsRes.data ?? []) as SavedProduct[]).map((product) => ({
        ...product,
        category: product.category ?? DEFAULT_PRODUCT_CATEGORY,
        is_favorite: product.is_favorite ?? false,
        proteins_per_100g: product.proteins_per_100g ?? 0,
        fats_per_100g: product.fats_per_100g ?? 0,
        carbohydrates_per_100g: product.carbohydrates_per_100g ?? 0,
      }))
    const normalizedSavedMeals = ((mealsRes.data ?? []) as SavedMeal[])
      .map(normalizeSavedMeal)
      .filter((meal): meal is SavedMeal => meal !== null)
    const savedProductsByName = new Map(
      normalizedSavedProducts.map((product) => [product.name.trim().toLocaleLowerCase('ru-RU'), product]),
    )
    const normalizeFoodLogs = (logs: unknown) => (logs as FoodLog[]).map((food) => {
      const lacksNutrition = !food.proteins_per_100g && !food.fats_per_100g && !food.carbohydrates_per_100g
      const savedProduct = savedProductsByName.get(food.product_name.trim().toLocaleLowerCase('ru-RU'))
      return {
        ...food,
        proteins_per_100g: lacksNutrition ? savedProduct?.proteins_per_100g ?? 0 : food.proteins_per_100g,
        fats_per_100g: lacksNutrition ? savedProduct?.fats_per_100g ?? 0 : food.fats_per_100g,
        carbohydrates_per_100g: lacksNutrition ? savedProduct?.carbohydrates_per_100g ?? 0 : food.carbohydrates_per_100g,
      }
    })
    const normalizedFoodHistory = normalizeFoodLogs(foodHistoryRes.data ?? [])
    const profileToday = isoDateInTimeZone(nextProfile.time_zone)
    setFoodLogs(normalizedFoodHistory.filter((food) => food.logged_on === profileToday))
    setFoodHistoryLogs(normalizedFoodHistory)
    setPathDayConfirmations((pathConfirmationsRes.data ?? []) as PathDayConfirmation[])
    setCourseLessonCompletions((courseLessonsRes.data ?? []) as CourseLessonCompletion[])
    setMindfulnessCategories((mindfulnessCategoriesRes.data ?? []) as MindfulnessCategory[])
    setMindfulnessNotes((mindfulnessNotesRes.data ?? []) as MindfulnessNote[])
    setBibleBookmarks((bibleBookmarksRes.data ?? []) as BibleBookmark[])
    setSavedMeals(normalizedSavedMeals)
    setSavedMealPlans((mealPlansRes.data ?? []) as SavedMealPlan[])
    setSavedProducts(normalizedSavedProducts)
    setSavedExercises((exercisesRes.data ?? []) as SavedExercise[])
    setScheduledExercises((scheduledExercisesRes.data ?? []) as ScheduledExercise[])
    setError(null)
    setLoading(false)

    try {
      const bibleReadingDate = isoDateInTimeZone(nextProfile.time_zone)
      const [bibleTreeResult, bibleReadsResult, adminResult] = await withDataLoadTimeout(Promise.all([
        client.rpc('refresh_bible_tree_progress'),
        client
          .from('bible_chapter_reads')
          .select('book_order,chapter')
          .eq('user_id', userId)
          .eq('read_on', bibleReadingDate)
          .limit(5),
        client.rpc('is_admin'),
      ]))

      if (bibleTreeResult.error) {
        if (!isBibleTreeFeatureMissing(bibleTreeResult.error)) {
          setError(bibleTreeResult.error.message)
        }
        setBibleTreeProgress(EMPTY_BIBLE_TREE_PROGRESS)
        setBibleTreeProgressDate(bibleReadingDate)
      } else {
        setBibleTreeProgress(normalizeBibleTreeProgress(bibleTreeResult.data))
        setBibleTreeProgressDate(bibleReadingDate)
        setBibleReadingVerifiedDate(bibleReadingDate)
      }

      if (!bibleReadsResult.error) {
        seedBibleDailyReadingChapters(
          userId,
          bibleReadingDate,
          (bibleReadsResult.data ?? []).map((read) => ({
            bookOrder: Number(read.book_order),
            chapter: Number(read.chapter),
          })),
        )
        setBibleReadingVerifiedDate(bibleReadingDate)
      }

      setIsAdmin(adminResult.error == null && adminResult.data === true)
    } catch (supplementaryLoadError) {
      setBibleTreeProgress(EMPTY_BIBLE_TREE_PROGRESS)
      setBibleTreeProgressDate(isoDateInTimeZone(nextProfile.time_zone))
      setIsAdmin(false)
      setError(
        supplementaryLoadError instanceof Error
          ? supplementaryLoadError.message
          : 'Не удалось загрузить дополнительные данные кабинета',
      )
    }
  }, [userEmail, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh, userId])

  useEffect(() => {
    let midnightTimer: number | undefined
    const syncReadingDate = () => {
      const nextDate = isoDateInTimeZone(profile?.time_zone)
      const nextCount = userId ? getBibleDailyReadingCount(userId, nextDate) : 0
      setBibleReadingVerifiedDate((currentDate) => currentDate === nextDate ? currentDate : null)
      setBibleDailyReading({ userId: userId ?? null, date: nextDate, count: nextCount })
      setBibleReadingDate(nextDate)
      midnightTimer = window.setTimeout(
        syncReadingDate,
        millisecondsUntilNextDayInTimeZone(profile?.time_zone) + 50,
      )
    }
    const initialTimer = window.setTimeout(syncReadingDate, 0)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearTimeout(midnightTimer)
    }
  }, [profile?.time_zone, userId])

  useEffect(() => {
    if (!userId || !profile) {
      const resetTimer = window.setTimeout(() => {
        setBibleDailyReading({ userId: null, date: bibleReadingDate, count: 0 })
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }

    const syncReadingCount = () => {
      setBibleDailyReading({
        userId,
        date: bibleReadingDate,
        count: Math.max(
          bibleTreeProgressDate === bibleReadingDate ? bibleTreeProgress.chaptersToday : 0,
          getBibleDailyReadingCount(userId, bibleReadingDate),
        ),
      })
    }

    const syncTimer = window.setTimeout(syncReadingCount, 0)
    const unsubscribe = subscribeBibleDailyReading((detail) => {
      if (detail.userId !== userId || detail.date !== bibleReadingDate) return
      setBibleDailyReading({
        userId,
        date: bibleReadingDate,
        count: Math.max(
          bibleTreeProgressDate === bibleReadingDate ? bibleTreeProgress.chaptersToday : 0,
          detail.count,
        ),
      })
    })
    return () => {
      window.clearTimeout(syncTimer)
      unsubscribe()
    }
  }, [bibleReadingDate, bibleTreeProgress.chaptersToday, bibleTreeProgressDate, profile, userId])

  useEffect(() => {
    if (!userId) return

    let timeout: number
    const scheduleRefreshAtMidnight = () => {
      timeout = window.setTimeout(async () => {
        await refresh()
        scheduleRefreshAtMidnight()
      }, millisecondsUntilNextDayInTimeZone(profile?.time_zone) + 50)
    }

    scheduleRefreshAtMidnight()
    return () => window.clearTimeout(timeout)
  }, [profile?.time_zone, refresh, userId])

  const resolveCalorieNormForDate = useCallback(async (
    loggedOn: string,
    { allowLegacyNormFallback = false }: { allowLegacyNormFallback?: boolean } = {},
  ) => {
    if (!user || !profile) return null

    const client = requireSupabase()
    const historyResult = await client
      .from('calorie_norm_history')
      .select('*')
      .eq('user_id', user.id)
      .lte('effective_on', loggedOn)
      .order('effective_on', { ascending: false })

    if (historyResult.error && !isCalorieNormHistoryMissing(historyResult.error)) {
      throw historyResult.error
    }

    const historyRows = historyResult.error
      ? []
      : historyResult.data as CalorieNormHistoryRow[]
    const history = historyRows[0] ?? null
    const dailyOverride = historyRows.find((row) => (
      row.effective_on === loggedOn
      && row.daily_calories_norm_override != null
    ))?.daily_calories_norm_override
    if (dailyOverride != null) return Number(dailyOverride)

    const currentNormAppliesToDate = Boolean(
      profile.calorie_adaptation_baseline_on
      && profile.calorie_adaptation_baseline_on <= loggedOn,
    )
    if (!history && !currentNormAppliesToDate && !allowLegacyNormFallback) return null

    const normProfile = history
      ? {
          ...profile,
          daily_calories_norm: history.daily_calories_norm === null
            ? null
            : Number(history.daily_calories_norm),
          calorie_adaptation_enabled: history.calorie_adaptation_enabled,
          calorie_adaptation_baseline_weight: history.calorie_adaptation_baseline_weight === null
            ? null
            : Number(history.calorie_adaptation_baseline_weight),
          calorie_adaptation_baseline_on: history.calorie_adaptation_baseline_on,
        }
      : profile
    const dailyCaloriesNorm = getCalorieAdaptation(normProfile, weightLogs, loggedOn).effectiveNorm

    if (!history && !historyResult.error && currentNormAppliesToDate) {
      const fallbackEffectiveOn = profile.calorie_adaptation_baseline_on
        && profile.calorie_adaptation_baseline_on <= loggedOn
        ? profile.calorie_adaptation_baseline_on
        : loggedOn
      const { error: snapshotError } = await client
        .from('calorie_norm_history')
        .upsert(
          {
            user_id: user.id,
            effective_on: fallbackEffectiveOn,
            daily_calories_norm: profile.daily_calories_norm,
            calorie_adaptation_enabled: profile.calorie_adaptation_enabled,
            calorie_adaptation_baseline_weight: profile.calorie_adaptation_baseline_weight,
            calorie_adaptation_baseline_on: profile.calorie_adaptation_baseline_on,
          },
          { onConflict: 'user_id,effective_on', ignoreDuplicates: true },
        )
      if (snapshotError && !isCalorieNormHistoryMissing(snapshotError)) throw snapshotError
    }

    return dailyCaloriesNorm
  }, [profile, user, weightLogs])

  const reconcileNutritionTaskDate = useCallback((
    loggedOn: string,
    { allowLegacyNormFallback = false }: { allowLegacyNormFallback?: boolean } = {},
  ) => {
    const runReconciliation = async () => {
      if (
        !user
        || !profile?.weight_enabled
        || loggedOn >= isoDateInTimeZone(profile?.time_zone)
      ) return

      const nutritionTasks = tasks.filter((task) => (
        isNutritionTask(task)
        && isoDateInTimeZone(profile.time_zone, new Date(task.created_at)) <= loggedOn
      ))
      if (!nutritionTasks.length) return

      const client = requireSupabase()

      try {
        const dailyCaloriesNorm = await resolveCalorieNormForDate(loggedOn, {
          allowLegacyNormFallback,
        })
        if (dailyCaloriesNorm === null) return

        const { data: dayFoodLogs, error: dayFoodError } = await client
          .from('daily_food_logs')
          .select('weight_grams,calories_per_100g')
          .eq('user_id', user.id)
          .eq('logged_on', loggedOn)
        if (dayFoodError) throw dayFoodError
        const totalCalories = (dayFoodLogs ?? []).reduce(
          (sum, log) => sum + (Number(log.weight_grams) / 100) * Number(log.calories_per_100g),
          0,
        )

        if (totalCalories <= dailyCaloriesNorm) {
          const results = await Promise.all(
            nutritionTasks.map((task) =>
              client
                .from('task_completions')
                .upsert(
                  {
                    task_id: task.id,
                    user_id: user.id,
                    completed_on: loggedOn,
                  },
                  { onConflict: 'task_id,completed_on' },
                )
                .select('*')
                .single(),
            ),
          )
          const failedResult = results.find((result) => result.error)
          if (failedResult?.error) throw failedResult.error

          const automaticCompletions = results.map((result) => result.data as TaskCompletion)
          const automaticTaskIds = new Set(automaticCompletions.map((completion) => completion.task_id))
          setCompletions((previous) => [
            ...previous.filter((completion) => !(
              automaticTaskIds.has(completion.task_id)
              && completion.completed_on === loggedOn
            )),
            ...automaticCompletions,
          ])
          return
        }

        const nutritionTaskIds = nutritionTasks.map((task) => task.id)
        const { error: deleteError } = await client
          .from('task_completions')
          .delete()
          .eq('user_id', user.id)
          .eq('completed_on', loggedOn)
          .in('task_id', nutritionTaskIds)
        if (deleteError) throw deleteError

        const nutritionTaskIdSet = new Set(nutritionTaskIds)
        setCompletions((previous) => previous.filter((completion) => !(
          nutritionTaskIdSet.has(completion.task_id)
          && completion.completed_on === loggedOn
        )))
      } catch (reconcileError) {
        setError(
          reconcileError instanceof Error
            ? reconcileError.message
            : 'Не удалось пересчитать статистику задачи питания',
        )
        throw reconcileError
      }
    }

    const queuedReconciliation = nutritionReconciliationQueueRef.current.then(
      runReconciliation,
      runReconciliation,
    )
    nutritionReconciliationQueueRef.current = queuedReconciliation.catch(() => undefined)
    return queuedReconciliation
  }, [profile, resolveCalorieNormForDate, tasks, user])

  const getCalorieNormOnDate = useCallback(
    (loggedOn: string) => resolveCalorieNormForDate(loggedOn, { allowLegacyNormFallback: true }),
    [resolveCalorieNormForDate],
  )

  const saveCalorieNormOnDate = useCallback(async (loggedOn: string, norm: number) => {
    if (!user || !profile || !isAdmin || !adminMode) {
      throw new Error('Редактирование нормы доступно только в режиме администратора')
    }
    if (loggedOn >= isoDateInTimeZone(profile.time_zone)) {
      throw new Error('Можно изменить норму только для прошедшей даты')
    }
    if (!Number.isFinite(norm) || norm <= 0) {
      throw new Error('Укажите положительное значение нормы калорий')
    }

    const client = requireSupabase()
    const historyResult = await client
      .from('calorie_norm_history')
      .select('*')
      .eq('user_id', user.id)
      .lte('effective_on', loggedOn)
      .order('effective_on', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (historyResult.error) {
      if (isCalorieNormHistoryMissing(historyResult.error)) {
        throw new Error('Сначала выполните обновлённый файл add_calorie_norm_history.sql в Supabase')
      }
      throw historyResult.error
    }

    const history = historyResult.data as CalorieNormHistoryRow | null
    const { error: saveError } = await client
      .from('calorie_norm_history')
      .upsert(
        {
          user_id: user.id,
          effective_on: loggedOn,
          daily_calories_norm: history
            ? history.daily_calories_norm
            : profile.daily_calories_norm,
          daily_calories_norm_override: norm,
          calorie_adaptation_enabled: history
            ? history.calorie_adaptation_enabled
            : profile.calorie_adaptation_enabled,
          calorie_adaptation_baseline_weight: history
            ? history.calorie_adaptation_baseline_weight
            : profile.calorie_adaptation_baseline_weight,
          calorie_adaptation_baseline_on: history
            ? history.calorie_adaptation_baseline_on
            : profile.calorie_adaptation_baseline_on,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,effective_on' },
      )
    if (saveError) {
      if (
        saveError.code === 'PGRST204'
        || saveError.code === '42703'
        || saveError.message?.includes('daily_calories_norm_override')
      ) {
        throw new Error('Повторно выполните обновлённый файл add_calorie_norm_history.sql в Supabase')
      }
      throw saveError
    }

    await reconcileNutritionTaskDate(loggedOn, { allowLegacyNormFallback: true })
  }, [adminMode, isAdmin, profile, reconcileNutritionTaskDate, user])

  useEffect(() => {
    if (!profile) return
    const today = isoDateInTimeZone(profile.time_zone)
    const yesterdayDate = parseISODate(today)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = localISODate(yesterdayDate)
    const firstTrackedDate = profile.calorie_adaptation_baseline_on
    const datesToReconcile = new Set([yesterday])
    if (firstTrackedDate && firstTrackedDate < today) {
      datesToReconcile.add(firstTrackedDate)
    }
    const legacyFallbackDate = firstTrackedDate
      ? foodHistoryLogs.reduce<string | null>((latest, log) => (
          log.logged_on < firstTrackedDate && (!latest || log.logged_on > latest)
            ? log.logged_on
            : latest
        ), null)
      : null
    if (legacyFallbackDate) datesToReconcile.add(legacyFallbackDate)
    const nutritionTaskSignature = tasks
      .filter(isNutritionTask)
      .map((task) => `${task.id}:${task.created_at}`)
      .sort()
      .join(',')
    const latestWeightSignature = weightLogs
      .map((log) => `${log.logged_on}:${log.value}`)
      .sort()
      .join(',')
    const historicalFoodSignature = foodHistoryLogs
      .filter((log) => datesToReconcile.has(log.logged_on))
      .map((log) => `${log.id}:${log.weight_grams}:${log.calories_per_100g}`)
      .sort()
      .join(',')
    const catchUpSignature = [
      user?.id ?? '',
      today,
      firstTrackedDate ?? '',
      profile.daily_calories_norm ?? '',
      profile.calorie_adaptation_enabled,
      profile.calorie_adaptation_baseline_weight ?? '',
      nutritionTaskSignature,
      latestWeightSignature,
      historicalFoodSignature,
    ].join('|')
    if (nutritionCatchUpSignatureRef.current === catchUpSignature) return
    nutritionCatchUpSignatureRef.current = catchUpSignature

    let retryTimer: number | undefined
    let cancelled = false
    const runCatchUp = () => Promise.all(
      [...datesToReconcile]
        .sort((left, right) => left.localeCompare(right))
        .map((date) => reconcileNutritionTaskDate(date, {
          allowLegacyNormFallback: date === legacyFallbackDate,
        })),
    )
    const timer = window.setTimeout(() => {
      void runCatchUp().catch(() => {
        if (cancelled) return
        nutritionCatchUpSignatureRef.current = null
        retryTimer = window.setTimeout(() => {
          if (cancelled) return
          nutritionCatchUpSignatureRef.current = catchUpSignature
          void runCatchUp().catch(() => {
            nutritionCatchUpSignatureRef.current = null
          })
        }, 3_000)
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(retryTimer)
    }
  }, [foodHistoryLogs, profile, reconcileNutritionTaskDate, tasks, user?.id, weightLogs])

  useEffect(() => {
    if (!user || !profile) return

    const bibleTask = tasks.find((task) => !task.withdrawal_syndrome && task.task_kind === 'bible_reading')
      ?? tasks.find((task) => !task.withdrawal_syndrome && isBibleReadingTask(task))
    if (!bibleTask) return

    const target = bibleTask.bible_daily_chapter_target ?? 5
    const completedOn = bibleReadingDate
    if (completedOn !== isoDateInTimeZone(profile.time_zone)) return
    if (
      bibleDailyReading.userId !== user.id
      || bibleDailyReading.date !== completedOn
    ) return

    const existingCompletion = completions.find(
      (completion) => completion.task_id === bibleTask.id && completion.completed_on === completedOn,
    )
    const verifiedServerCount = bibleTreeProgressDate === completedOn
      ? bibleTreeProgress.chaptersToday
      : 0
    const chaptersReadForCompletion = Math.max(bibleChaptersReadToday, verifiedServerCount)
    const targetReached = chaptersReadForCompletion >= target
    if (targetReached && bibleReadingVerifiedDate !== completedOn) return
    if (!targetReached && !existingCompletion) return
    if (
      !targetReached
      && (target > BIBLE_SERVER_DAILY_CHAPTER_LIMIT || bibleReadingVerifiedDate !== completedOn)
    ) return
    if (targetReached && existingCompletion) return

    const pendingKey = `${bibleTask.id}:${completedOn}`
    if (bibleCompletionPendingRef.current.has(pendingKey)) return
    bibleCompletionPendingRef.current.add(pendingKey)

    const reconcileBibleTask = async () => {
      try {
        const client = requireSupabase()
        if (targetReached) {
          const { data, error: completionError } = await client
            .from('task_completions')
            .upsert(
              {
                task_id: bibleTask.id,
                user_id: user.id,
                completed_on: completedOn,
              },
              { onConflict: 'task_id,completed_on' },
            )
            .select('*')
            .single()
          if (completionError) throw completionError
          const completion = data as TaskCompletion
          setCompletions((previous) => [
            ...previous.filter((item) => !(
              item.task_id === bibleTask.id && item.completed_on === completedOn
            )),
            completion,
          ])
        } else {
          const { error: completionError } = await client
            .from('task_completions')
            .delete()
            .eq('id', existingCompletion!.id)
          if (completionError) throw completionError
          setCompletions((previous) => previous.filter((item) => item.id !== existingCompletion!.id))
        }
      } catch (completionError) {
        setError(
          completionError instanceof Error
            ? completionError.message
            : 'Не удалось синхронизировать задачу чтения Библии',
        )
      } finally {
        bibleCompletionPendingRef.current.delete(pendingKey)
      }
    }

    void reconcileBibleTask()
  }, [bibleChaptersReadToday, bibleDailyReading, bibleReadingDate, bibleReadingVerifiedDate, bibleTreeProgress.chaptersToday, bibleTreeProgressDate, completions, profile, tasks, user])

  const value = useMemo<DataContextValue>(
    () => ({
      profile,
      tasks,
      completions,
      weightLogs,
      foodLogs,
      foodHistoryLogs,
      bibleBookmarks,
      bibleTreeProgress,
      bibleTreeProgressDate,
      bibleChaptersReadToday,
      pathDayConfirmations,
      courseLessonCompletions,
      mindfulnessCategories,
      mindfulnessNotes,
      savedMeals,
      savedMealPlans,
      savedProducts,
      savedExercises,
      scheduledExercises,
      loading,
      error,
      isAdmin,
      adminMode: isAdmin && adminMode,
      setAdminMode,
      refresh,
      getCalorieNormOnDate,
      saveCalorieNormOnDate,
      async completeToday(taskId) {
        if (!user) return
        const task = tasks.find((item) => item.id === taskId)
        if (profile?.weight_enabled && task && isNutritionTask(task)) {
          throw new Error('Эта задача отмечается автоматически по дневной норме калорий')
        }
        const today = task && isBibleReadingTask(task)
          ? isoDateInTimeZone(profile?.time_zone)
          : localISODate()
        const existing = completions.find(
          (c) => c.task_id === taskId && c.completed_on === today,
        )
        if (existing) return
        const { data, error: insError } = await requireSupabase()
          .from('task_completions')
          .upsert(
            {
              task_id: taskId,
              user_id: user.id,
              completed_on: today,
            },
            { onConflict: 'task_id,completed_on' },
          )
          .select('*')
          .single()
        if (insError) throw insError
        const completion = data as TaskCompletion
        setCompletions((prev) => [
          ...prev.filter((item) => !(item.task_id === taskId && item.completed_on === today)),
          completion,
        ])
      },
      async addTask(
        title,
        habitDays,
        withdrawalSyndrome = false,
        invertedLogic = false,
        options = {},
      ) {
        if (!user) return
        const taskKind = withdrawalSyndrome ? null : options.taskKind ?? null
        const bibleDailyChapterTarget = taskKind === 'bible_reading'
          ? options.bibleDailyChapterTarget ?? 5
          : null
        const nextSortOrder = tasks.reduce(
          (maximum, task) => Math.max(maximum, task.sort_order),
          -1,
        ) + 1 + (taskKind === 'bible_reading' ? 1 : 0)
        if (
          bibleDailyChapterTarget != null
          && (!Number.isInteger(bibleDailyChapterTarget) || bibleDailyChapterTarget < 1)
        ) {
          throw new Error('Количество глав должно быть целым числом от 1')
        }
        const { data, error: insError } = await requireSupabase()
          .from('tasks')
          .insert({
            user_id: user.id,
            title,
            task_kind: taskKind,
            bible_daily_chapter_target: bibleDailyChapterTarget,
            habit_days: habitDays,
            sort_order: nextSortOrder,
            withdrawal_syndrome: withdrawalSyndrome,
            inverted_logic: !withdrawalSyndrome
              && !isNutritionTask({ title, task_kind: taskKind })
              && !isBibleReadingTask({ title, task_kind: taskKind })
              && invertedLogic,
            withdrawal_started_on: withdrawalSyndrome ? localISODate() : null,
          })
          .select('*')
          .single()
        if (insError) throw insError
        const insertedTask = data as Task
        setTasks((prev) => [...prev, {
          ...insertedTask,
          task_kind: insertedTask.task_kind ?? null,
          bible_daily_chapter_target: insertedTask.bible_daily_chapter_target ?? null,
          inverted_logic_history: normalizeTaskInvertedLogicHistory(
            insertedTask.inverted_logic_history,
            insertedTask.inverted_logic,
            isoDateInTimeZone(profile?.time_zone),
          ),
        }])
      },
      async updateTask(id, patch) {
        const currentTask = tasks.find((task) => task.id === id)
        const nextTitle = patch.title ?? currentTask?.title ?? ''
        const nextTaskKind = patch.task_kind ?? currentTask?.task_kind ?? null
        if (
          patch.bible_daily_chapter_target != null
          && (!Number.isInteger(patch.bible_daily_chapter_target) || patch.bible_daily_chapter_target < 1)
        ) {
          throw new Error('Количество глав должно быть целым числом от 1')
        }
        const isDefaultAutomaticTask = isNutritionTask({ title: nextTitle, task_kind: nextTaskKind })
          || isBibleReadingTask({ title: nextTitle, task_kind: nextTaskKind })
        const nextPatch = isDefaultAutomaticTask
          ? { ...patch, inverted_logic: false }
          : patch
        const inversionChanged = nextPatch.inverted_logic !== undefined
          && nextPatch.inverted_logic !== currentTask?.inverted_logic
        const markedToday = completions.some(
          (completion) => completion.task_id === id && completion.completed_on === localISODate(),
        )
        if (inversionChanged && markedToday) {
          throw new Error('Инверсию логики нельзя изменить после отметки задачи за сегодня')
        }
        const { data, error: updError } = await requireSupabase()
          .from('tasks')
          .update(nextPatch)
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        const updatedTask = data as Task
        const effectiveOn = isoDateInTimeZone(profile?.time_zone)
        const updatedHistory = Array.isArray(updatedTask.inverted_logic_history)
          ? normalizeTaskInvertedLogicHistory(
              updatedTask.inverted_logic_history,
              updatedTask.inverted_logic,
              effectiveOn,
            )
          : inversionChanged
            ? recordTaskInvertedLogicChange(
                currentTask?.inverted_logic_history ?? [],
                updatedTask.inverted_logic,
                effectiveOn,
              )
            : currentTask?.inverted_logic_history ?? []
        setTasks((prev) => prev.map((task) => (task.id === id
          ? {
              ...updatedTask,
              task_kind: updatedTask.task_kind ?? null,
              bible_daily_chapter_target: updatedTask.bible_daily_chapter_target ?? null,
              inverted_logic_history: updatedHistory,
            }
          : task)))
      },
      async restartWithdrawalTask(taskId) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const { data, error: updError } = await requireSupabase()
          .from('tasks')
          .update({ withdrawal_restart_on: localISODate(tomorrow) })
          .eq('id', taskId)
          .select('*')
          .single()
        if (updError) throw updError
        const restartedTask = data as Task
        setTasks((prev) => prev.map((task) => (task.id === taskId
          ? {
              ...restartedTask,
              task_kind: restartedTask.task_kind ?? null,
              bible_daily_chapter_target: restartedTask.bible_daily_chapter_target ?? null,
              inverted_logic_history: Array.isArray(restartedTask.inverted_logic_history)
                ? normalizeTaskInvertedLogicHistory(
                    restartedTask.inverted_logic_history,
                    restartedTask.inverted_logic,
                    isoDateInTimeZone(profile?.time_zone),
                  )
                : task.inverted_logic_history,
            }
          : task)))
      },
      async deleteTask(id) {
        const { error: delError } = await requireSupabase().from('tasks').delete().eq('id', id)
        if (delError) throw delError
        setTasks((prev) => prev.filter((t) => t.id !== id))
        setCompletions((prev) => prev.filter((c) => c.task_id !== id))
      },
      async saveNegativeHabitsSecurity(patch) {
        if (!user || !profile) return
        if (patch.pin !== undefined && !/^\d{4}$/.test(patch.pin)) {
          throw new Error('PIN должен состоять из четырёх цифр')
        }
        const update: { negative_habits_pin?: string; negative_habits_pin_required?: boolean } = {}
        if (patch.pin !== undefined) update.negative_habits_pin = patch.pin
        if (patch.requirePin !== undefined) update.negative_habits_pin_required = patch.requirePin
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update(update)
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
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
        const currentWeight = getCalorieAdaptation(profile, weightLogs).currentWeight
        const fallbackWeight = Number(profile.target_weight)
        const baselineWeight = norm == null
          ? null
          : currentWeight ?? (Number.isFinite(fallbackWeight) && fallbackWeight > 0 ? fallbackWeight : null)
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({
            daily_calories_norm: norm,
            calorie_adaptation_baseline_weight: baselineWeight,
            calorie_adaptation_baseline_on: norm == null
              ? null
              : isoDateInTimeZone(profile.time_zone),
          })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveCalorieAdaptationEnabled(enabled) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({ calorie_adaptation_enabled: enabled })
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
      async saveDiaryStatisticsTargets(targets) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({ diary_statistics_targets: targets })
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
      async saveLocation(timeZone, city) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({
            time_zone: timeZone,
            city_name: city?.name ?? null,
            city_latitude: city?.latitude ?? null,
            city_longitude: city?.longitude ?? null,
          })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveAnnualCycleEnabled(enabled) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({ annual_cycle_enabled: enabled })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveShabbatTheme(theme) {
        if (!user || !profile) return
        const { data, error: updError } = await requireSupabase()
          .from('profiles')
          .update({ shabbat_theme: theme })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        setProfile(data as Profile)
      },
      async saveBibleReadingPosition(bookOrder, chapter) {
        if (!user || !profile) return
        const client = requireSupabase()
        const { data, error: updError } = await client.rpc('save_bible_reading_position', {
          p_book_order: bookOrder,
          p_chapter: chapter,
        })
        if (updError?.code === 'PGRST202' || updError?.code === '42883') {
          const fallback = await client
            .from('profiles')
            .update({
              last_bible_book_order: bookOrder,
              last_bible_chapter: chapter,
            })
            .eq('id', user.id)
            .select('*')
            .single()
          if (fallback.error) throw fallback.error
          setProfile(fallback.data as Profile)
          return
        }
        if (updError) throw updError
        const updatedProfile = Array.isArray(data) ? data[0] : data
        setProfile(updatedProfile as Profile)
      },
      async recordBibleChapterRead(bookOrder, chapter) {
        if (!user) return null
        const readingDate = isoDateInTimeZone(profile?.time_zone)
        const client = requireSupabase()
        const { data, error: recordError } = await client.rpc('record_bible_chapter_read', {
          p_book_order: bookOrder,
          p_chapter: chapter,
        })
        if (recordError) {
          if (isBibleTreeFeatureMissing(recordError)) {
            setBibleTreeProgress(EMPTY_BIBLE_TREE_PROGRESS)
            setBibleTreeProgressDate(readingDate)
            return null
          }
          throw recordError
        }
        const nextProgress = normalizeBibleTreeProgress(data)
        setBibleTreeProgress(nextProgress)
        setBibleTreeProgressDate(readingDate)
        setBibleReadingVerifiedDate(readingDate)
        if (nextProgress.chaptersToday >= 5) {
          const readsResult = await client
            .from('bible_chapter_reads')
            .select('book_order,chapter')
            .eq('user_id', user.id)
            .eq('read_on', readingDate)
            .limit(5)
          if (!readsResult.error) {
            seedBibleDailyReadingChapters(
              user.id,
              readingDate,
              (readsResult.data ?? []).map((read) => ({
                bookOrder: Number(read.book_order),
                chapter: Number(read.chapter),
              })),
            )
          }
        }
        return nextProgress
      },
      async refreshBibleTreeProgress() {
        if (!user) return
        const readingDate = isoDateInTimeZone(profile?.time_zone)
        const client = requireSupabase()
        const [progressResult, readsResult] = await Promise.all([
          client.rpc('refresh_bible_tree_progress'),
          client
            .from('bible_chapter_reads')
            .select('book_order,chapter')
            .eq('user_id', user.id)
            .eq('read_on', readingDate)
            .limit(5),
        ])
        const { data, error: refreshError } = progressResult
        if (refreshError) {
          if (isBibleTreeFeatureMissing(refreshError)) {
            setBibleTreeProgress(EMPTY_BIBLE_TREE_PROGRESS)
            setBibleTreeProgressDate(readingDate)
            return
          }
          throw refreshError
        }
        setBibleTreeProgress(normalizeBibleTreeProgress(data))
        setBibleTreeProgressDate(readingDate)
        setBibleReadingVerifiedDate(readingDate)
        if (!readsResult.error) {
          seedBibleDailyReadingChapters(
            user.id,
            readingDate,
            (readsResult.data ?? []).map((read) => ({
              bookOrder: Number(read.book_order),
              chapter: Number(read.chapter),
            })),
          )
        }
      },
      async addBibleBookmark(bookOrder, chapter, verse, title, color) {
        if (!user) throw new Error('Не удалось определить пользователя')
        const { data, error: insertError } = await requireSupabase()
          .from('bible_bookmarks')
          .insert({
            user_id: user.id,
            book_order: bookOrder,
            chapter,
            verse,
            title: title.trim(),
            color,
          })
          .select('*')
          .single()
        if (insertError) throw insertError
        const bookmark = data as BibleBookmark
        setBibleBookmarks((previous) => [bookmark, ...previous])
        return bookmark
      },
      async updateBibleBookmark(id, title, color) {
        const { data, error: updateError } = await requireSupabase()
          .from('bible_bookmarks')
          .update({ title: title.trim(), color })
          .eq('id', id)
          .select('*')
          .single()
        if (updateError) throw updateError
        const bookmark = data as BibleBookmark
        setBibleBookmarks((previous) => previous.map((item) => item.id === id ? bookmark : item))
      },
      async deleteBibleBookmark(id) {
        const { error: deleteError } = await requireSupabase()
          .from('bible_bookmarks')
          .delete()
          .eq('id', id)
        if (deleteError) throw deleteError
        setBibleBookmarks((previous) => previous.filter((bookmark) => bookmark.id !== id))
      },
      async saveBibleBookmarkColorLabel(color, label) {
        if (!user || !profile) return
        const nextLabels = { ...(profile.bible_bookmark_color_labels ?? {}) }
        const normalizedLabel = label.trim()
        if (normalizedLabel) nextLabels[color] = normalizedLabel
        else delete nextLabels[color]

        const { data, error: updateError } = await requireSupabase()
          .from('profiles')
          .update({ bible_bookmark_color_labels: nextLabels })
          .eq('id', user.id)
          .select('*')
          .single()
        if (updateError) throw updateError
        setProfile(data as Profile)
      },
      async getBibleChapter(bookOrder, chapter, includeTorahPortions = false) {
        const { data, error: selectError } = await requireSupabase()
          .from(includeTorahPortions ? 'bible_verses_with_torah_markers' : 'bible_verses')
          .select('*')
          .eq('book_order', bookOrder)
          .eq('chapter', chapter)
          .order('verse')
        if (selectError) throw selectError
        return (data ?? []) as BibleVerse[]
      },
      async getTorahPortions(bookOrder) {
        const { data, error: selectError } = await requireSupabase()
          .from('torah_portions')
          .select('id, portion_number, name_en, name_he, name_ru, book_order, book_code, start_chapter, start_verse, end_chapter, end_verse')
          .eq('book_order', bookOrder)
          .order('portion_number')
        if (selectError) throw selectError
        return (data ?? []) as TorahPortion[]
      },
      async confirmPathDay(day, cycleStartedOn) {
        if (!user) return
        const { data, error: upsertError } = await requireSupabase()
          .from('path_day_confirmations')
          .upsert(
            {
              user_id: user.id,
              cycle_started_on: cycleStartedOn,
              day,
            },
            { onConflict: 'user_id,cycle_started_on,day' },
          )
          .select('*')
          .single()
        if (upsertError) throw upsertError
        setPathDayConfirmations((previous) => [
          ...previous.filter((confirmation) => confirmation.id !== (data as PathDayConfirmation).id),
          data as PathDayConfirmation,
        ])
      },
      async completeCourseLesson(courseId, lessonNumber) {
        if (!user) return
        const { data, error: upsertError } = await requireSupabase()
          .from('course_lesson_completions')
          .upsert(
            {
              user_id: user.id,
              course_id: courseId,
              lesson_number: lessonNumber,
            },
            { onConflict: 'user_id,course_id,lesson_number' },
          )
          .select('*')
          .single()
        if (upsertError) throw upsertError
        setCourseLessonCompletions((previous) => [
          ...previous.filter((completion) => completion.id !== (data as CourseLessonCompletion).id),
          data as CourseLessonCompletion,
        ])
      },
      async addMindfulnessCategory(name) {
        if (!user) throw new Error('Необходимо войти в аккаунт')
        const { data, error: insError } = await requireSupabase()
          .from('mindfulness_categories')
          .insert({ user_id: user.id, name })
          .select('*')
          .single()
        if (insError) throw insError
        const category = data as MindfulnessCategory
        setMindfulnessCategories((previous) => [...previous, category])
        return category
      },
      async deleteMindfulnessCategory(id, destinationCategoryId) {
        const client = requireSupabase()
        const { error: moveError } = await client
          .from('mindfulness_notes')
          .update({ category_id: destinationCategoryId, updated_at: new Date().toISOString() })
          .eq('category_id', id)
        if (moveError) throw moveError

        const { error: deleteError } = await client
          .from('mindfulness_categories')
          .delete()
          .eq('id', id)
        if (deleteError) throw deleteError

        setMindfulnessNotes((previous) => previous.map((note) => (
          note.category_id === id ? { ...note, category_id: destinationCategoryId } : note
        )))
        setMindfulnessCategories((previous) => previous.filter((category) => category.id !== id))
      },
      async addMindfulnessNote(title, content, categoryId) {
        if (!user) throw new Error('Необходимо войти в аккаунт')
        const { data, error: insError } = await requireSupabase()
          .from('mindfulness_notes')
          .insert({ user_id: user.id, title, content, category_id: categoryId })
          .select('*')
          .single()
        if (insError) throw insError
        const note = data as MindfulnessNote
        setMindfulnessNotes((previous) => [note, ...previous])
        return note
      },
      async updateMindfulnessNote(id, title, content, categoryId) {
        const { data, error: updError } = await requireSupabase()
          .from('mindfulness_notes')
          .update({ title, content, category_id: categoryId, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        setMindfulnessNotes((previous) => [
          data as MindfulnessNote,
          ...previous.filter((note) => note.id !== id),
        ])
      },
      async deleteMindfulnessNote(id) {
        const { error: delError } = await requireSupabase()
          .from('mindfulness_notes')
          .delete()
          .eq('id', id)
        if (delError) throw delError
        setMindfulnessNotes((previous) => previous.filter((note) => note.id !== id))
      },
      async logFoodToday(productName, weightGrams, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g) {
        if (!user) return
        const today = isoDateInTimeZone(profile?.time_zone)
        const { data, error: insError } = await requireSupabase()
          .from('daily_food_logs')
          .insert({
            user_id: user.id,
            logged_on: today,
            product_name: productName,
            weight_grams: weightGrams,
            calories_per_100g: caloriesPer100g,
            proteins_per_100g: proteinsPer100g,
            fats_per_100g: fatsPer100g,
            carbohydrates_per_100g: carbohydratesPer100g,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setFoodLogs((prev) => [...prev, data as FoodLog])
        setFoodHistoryLogs((prev) => [...prev, data as FoodLog])
      },
      async logFoodOnDate(loggedOn, productName, weightGrams, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g) {
        if (!user || !isAdmin || !adminMode) {
          throw new Error('Добавление доступно только в режиме администратора')
        }
        if (loggedOn >= isoDateInTimeZone(profile?.time_zone)) {
          throw new Error('Выберите прошедшую календарную дату')
        }
        const { data, error: insError } = await requireSupabase()
          .from('daily_food_logs')
          .insert({
            user_id: user.id,
            logged_on: loggedOn,
            product_name: productName,
            weight_grams: weightGrams,
            calories_per_100g: caloriesPer100g,
            proteins_per_100g: proteinsPer100g,
            fats_per_100g: fatsPer100g,
            carbohydrates_per_100g: carbohydratesPer100g,
        })
          .select('*')
          .single()
        if (insError) throw insError
        const insertedFood = data as FoodLog
        const nextHistoryLogs = [...foodHistoryLogs, insertedFood]
        setFoodHistoryLogs(nextHistoryLogs)
        await reconcileNutritionTaskDate(loggedOn, { allowLegacyNormFallback: true })
      },
      async updateFoodLogProductName(id, productName) {
        if (!user || !isAdmin || !adminMode) {
          throw new Error('Редактирование доступно только в режиме администратора')
        }
        const { data, error: updError } = await requireSupabase()
          .from('daily_food_logs')
          .update({ product_name: productName })
          .eq('id', id)
          .eq('user_id', user.id)
          .select('*')
          .single()
        if (updError) throw updError
        const updatedFood = data as FoodLog
        const nextHistoryLogs = foodHistoryLogs.map((food) => food.id === id ? updatedFood : food)
        setFoodLogs((previous) => previous.map((food) => food.id === id ? updatedFood : food))
        setFoodHistoryLogs(nextHistoryLogs)
        await reconcileNutritionTaskDate(updatedFood.logged_on, { allowLegacyNormFallback: true })
      },
      async deleteFoodLog(id) {
        if (!user) return
        const deletedFood = foodHistoryLogs.find((food) => food.id === id)
        const { error: delError } = await requireSupabase()
          .from('daily_food_logs')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)
        if (delError) throw delError
        setFoodLogs((prev) => prev.filter((f) => f.id !== id))
        const nextHistoryLogs = foodHistoryLogs.filter((food) => food.id !== id)
        setFoodHistoryLogs(nextHistoryLogs)
        if (deletedFood) {
          await reconcileNutritionTaskDate(deletedFood.logged_on, { allowLegacyNormFallback: true })
        }
      },
      async addSavedProduct(name, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g, category, isFavorite) {
        if (!user) throw new Error('Пользователь не авторизован')
        const { data, error: insError } = await requireSupabase()
          .from('saved_products')
          .insert({
            user_id: user.id,
          name,
          calories_per_100g: caloriesPer100g,
          proteins_per_100g: proteinsPer100g,
          fats_per_100g: fatsPer100g,
          carbohydrates_per_100g: carbohydratesPer100g,
          category,
          is_favorite: isFavorite,
          })
          .select('*')
          .single()
        if (insError) throw insError
        const savedProduct = data as SavedProduct
        setSavedProducts((prev) =>
          [...prev, savedProduct].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
        return savedProduct
      },
      async updateSavedProduct(id, name, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g, category, isFavorite) {
        if (!user) throw new Error('Пользователь не авторизован')

        const existingProduct = savedProducts.find((product) => product.id === id)
        if (!existingProduct) {
          throw new Error('Продукт больше не найден в разделе «Продукты»')
        }

        const { data, error: updError } = await requireSupabase()
          .from('saved_products')
          .update({
          name,
          calories_per_100g: caloriesPer100g,
          proteins_per_100g: proteinsPer100g,
          fats_per_100g: fatsPer100g,
          carbohydrates_per_100g: carbohydratesPer100g,
          category,
          is_favorite: isFavorite,
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select('*')
          .single()
        if (updError) throw updError

        const updatedProduct = data as SavedProduct
        if (updatedProduct.id !== existingProduct.id) {
          throw new Error('Не удалось сохранить связь продукта с меню')
        }
        setSavedProducts((prev) =>
          prev.map((product) => (product.id === id ? updatedProduct : product))
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
        if (!user) throw new Error('Пользователь не авторизован')

        let usedInMeal = savedMeals.find((meal) => (
          meal.items.some((item) => item.saved_product_id === id)
        ))
        const client = requireSupabase()
        if (!usedInMeal) {
          const { data: currentMeals, error: mealsError } = await client
            .from('saved_meals')
            .select('id,user_id,name,items,created_at')
            .eq('user_id', user.id)
          if (mealsError && !isSavedMealsFeatureMissing(mealsError)) throw mealsError
          usedInMeal = ((currentMeals ?? []) as SavedMeal[])
            .map(normalizeSavedMeal)
            .filter((meal): meal is SavedMeal => meal !== null)
            .find((meal) => meal.items.some((item) => item.saved_product_id === id))
        }
        if (usedInMeal) {
          throw new Error(`Продукт используется в меню «${usedInMeal.name}». Сначала удалите этот приём пищи.`)
        }
        const { error: delError } = await client
          .from('saved_products')
          .delete()
          .eq('id', id)
        if (delError) throw delError
        setSavedProducts((prev) => prev.filter((product) => product.id !== id))
      },
      async addSavedMeal(name, items) {
        if (!user) throw new Error('Пользователь не авторизован')

        const normalizedName = name.trim()
        if (!normalizedName) {
          throw new Error('Введите название приёма пищи')
        }
        if (normalizedName.length > SAVED_MEAL_NAME_MAX_LENGTH) {
          throw new Error(`Название приёма пищи не должно превышать ${SAVED_MEAL_NAME_MAX_LENGTH} символов`)
        }
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error('Добавьте хотя бы один продукт')
        }
        if (items.length > SAVED_MEAL_ITEMS_MAX_COUNT) {
          throw new Error(`В одном приёме пищи может быть не более ${SAVED_MEAL_ITEMS_MAX_COUNT} продуктов`)
        }

        const normalizedItems = normalizeSavedMealItems(items)
        if (normalizedItems.length !== items.length) {
          throw new Error('Проверьте выбранный продукт и его вес')
        }

        const client = requireSupabase()
        const savedProductIds = [...new Set(
          normalizedItems.map((item) => item.saved_product_id),
        )]
        const { data: existingProducts, error: productsError } = await client
          .from('saved_products')
          .select('id')
          .eq('user_id', user.id)
          .in('id', savedProductIds)
        if (productsError) throw productsError
        if ((existingProducts ?? []).length !== savedProductIds.length) {
          throw new Error('Один из продуктов больше не найден в разделе «Продукты»')
        }

        const { data, error: insError } = await client
          .from('saved_meals')
          .insert({
            user_id: user.id,
            name: normalizedName,
            items: normalizedItems,
          })
          .select('*')
          .single()

        if (insError) {
          if (isSavedMealsFeatureMissing(insError)) {
            throw new Error('Таблица меню ещё не создана. Выполните supabase/add_saved_meals.sql в Supabase')
          }
          if (insError.code === '23505') {
            throw new Error('Приём пищи с таким названием уже сохранён')
          }
          throw insError
        }

        const savedMeal = normalizeSavedMeal(data as SavedMeal)
        if (!savedMeal) {
          throw new Error('Не удалось прочитать сохранённый приём пищи')
        }
        setSavedMeals((previous) => [...previous, savedMeal].sort((a, b) => (
          a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name, 'ru')
        )))
      },
      async updateSavedMeal(id, name, items) {
        if (!user) throw new Error('Пользователь не авторизован')

        const normalizedName = name.trim()
        if (!normalizedName) {
          throw new Error('Введите название приёма пищи')
        }
        if (normalizedName.length > SAVED_MEAL_NAME_MAX_LENGTH) {
          throw new Error(`Название приёма пищи не должно превышать ${SAVED_MEAL_NAME_MAX_LENGTH} символов`)
        }
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error('Добавьте хотя бы один продукт')
        }
        if (items.length > SAVED_MEAL_ITEMS_MAX_COUNT) {
          throw new Error(`В одном приёме пищи может быть не более ${SAVED_MEAL_ITEMS_MAX_COUNT} продуктов`)
        }

        const normalizedItems = normalizeSavedMealItems(items)
        if (normalizedItems.length !== items.length) {
          throw new Error('Проверьте выбранный продукт и его вес')
        }

        const client = requireSupabase()
        const savedProductIds = [...new Set(
          normalizedItems.map((item) => item.saved_product_id),
        )]
        const { data: existingProducts, error: productsError } = await client
          .from('saved_products')
          .select('id')
          .eq('user_id', user.id)
          .in('id', savedProductIds)
        if (productsError) throw productsError
        if ((existingProducts ?? []).length !== savedProductIds.length) {
          throw new Error('Один из продуктов больше не найден в разделе «Продукты»')
        }

        const { data, error: updError } = await client
          .from('saved_meals')
          .update({
            name: normalizedName,
            items: normalizedItems,
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select('*')
          .single()

        if (updError) {
          if (isSavedMealsFeatureMissing(updError)) {
            throw new Error('Таблица меню ещё не создана. Выполните supabase/add_saved_meals.sql в Supabase')
          }
          if (updError.code === '23505') {
            throw new Error('Приём пищи с таким названием уже сохранён')
          }
          throw updError
        }

        const savedMeal = normalizeSavedMeal(data as SavedMeal)
        if (!savedMeal) {
          throw new Error('Не удалось прочитать сохранённый приём пищи')
        }
        setSavedMeals((previous) => previous.map((meal) => (
          meal.id === id ? savedMeal : meal
        )))
      },
      async deleteSavedMeal(id) {
        if (!user) throw new Error('Пользователь не авторизован')
        const { error: delError } = await requireSupabase()
          .from('saved_meals')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)
        if (delError) throw delError
        setSavedMeals((previous) => previous.filter((meal) => meal.id !== id))
      },
      async scheduleSavedMeals(plannedOn, savedMealIds) {
        if (!user) throw new Error('Пользователь не авторизован')
        const uniqueMealIds = [...new Set(savedMealIds)]
        if (!/^\d{4}-\d{2}-\d{2}$/u.test(plannedOn) || uniqueMealIds.length === 0) {
          throw new Error('Выберите дату и приём пищи')
        }
        const existingIds = new Set(savedMeals.map((meal) => meal.id))
        if (uniqueMealIds.some((id) => !existingIds.has(id))) {
          throw new Error('Один из приёмов пищи больше не найден')
        }
        const { data, error: insertError } = await requireSupabase()
          .from('saved_meal_plans')
          .insert({ user_id: user.id, planned_on: plannedOn, saved_meal_ids: uniqueMealIds })
          .select('*')
          .single()
        if (insertError) {
          if (isSavedMealPlansFeatureMissing(insertError)) {
            throw new Error('Выполните обновлённый файл supabase/add_saved_meals.sql в Supabase')
          }
          throw insertError
        }
        setSavedMealPlans((previous) => [...previous, data as SavedMealPlan])
      },
      async deleteSavedMealPlan(id) {
        if (!user) throw new Error('Пользователь не авторизован')
        const { error: deleteError } = await requireSupabase()
          .from('saved_meal_plans')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)
        if (deleteError) throw deleteError
        setSavedMealPlans((previous) => previous.filter((plan) => plan.id !== id))
      },
      async addSavedExercise(name, category, exerciseType, restTimerEnabled, doubleVolume) {
        if (!user) return
        const { data, error: insError } = await requireSupabase()
          .from('saved_exercises')
          .insert({
            user_id: user.id,
            name,
            category,
            exercise_type: exerciseType,
            rest_timer_enabled: restTimerEnabled,
            double_volume: doubleVolume,
          })
          .select('*')
          .single()
        if (insError) throw insError
        setSavedExercises((prev) =>
          [...prev, data as SavedExercise].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
      },
      async updateSavedExercise(id, name, exerciseType, restTimerEnabled, doubleVolume) {
        const previousExercise = savedExercises.find((exercise) => exercise.id === id)
        const { data, error: updError } = await requireSupabase()
          .from('saved_exercises')
          .update({
            name,
            exercise_type: exerciseType,
            rest_timer_enabled: restTimerEnabled,
            double_volume: doubleVolume,
          })
          .eq('id', id)
          .select('*')
          .single()
        if (updError) throw updError
        setSavedExercises((prev) =>
          prev.map((exercise) => (exercise.id === id ? (data as SavedExercise) : exercise))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
        if (previousExercise && Boolean(previousExercise.double_volume) !== doubleVolume) {
          setScheduledExercises((prev) => prev.map((exercise) => (
            exercise.user_id === previousExercise.user_id
            && exercise.category === previousExercise.category
            && exercise.exercise_name === previousExercise.name
              ? { ...exercise, double_volume: doubleVolume }
              : exercise
          )))
        }
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
            double_volume: exercise.double_volume,
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
      bibleBookmarks,
      bibleTreeProgress,
      bibleTreeProgressDate,
      bibleChaptersReadToday,
      pathDayConfirmations,
      courseLessonCompletions,
      mindfulnessCategories,
      mindfulnessNotes,
      savedMeals,
      savedMealPlans,
      savedProducts,
      savedExercises,
      scheduledExercises,
      loading,
      error,
      isAdmin,
      adminMode,
      setAdminMode,
      refresh,
      getCalorieNormOnDate,
      saveCalorieNormOnDate,
      reconcileNutritionTaskDate,
      user,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
