import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { BIBLE_GROWTH_TOTAL_STEPS } from '../lib/bible-growth'
import { localISODate } from '../lib/dates'
import { isNutritionTask } from '../lib/nutrition-task'
import { DEFAULT_PRODUCT_CATEGORY, type ProductCategory } from '../lib/product-categories'
import { requirePublicSupabase } from '../lib/supabase'
import {
  getSavedFontScale,
  getSavedTheme,
  normalizeFontScale,
  normalizeShabbatTheme,
  normalizeTheme,
} from '../lib/theme'
import type {
  BibleBookmark,
  BibleTreeProgress,
  BibleVerse,
  CourseLessonCompletion,
  FoodLog,
  MealPlanEntry,
  MindfulnessCategory,
  MindfulnessNote,
  PathDayConfirmation,
  Profile,
  SavedExercise,
  SavedProduct,
  ScheduledExercise,
  Task,
  TaskCompletion,
  TorahPortion,
  WeightLog,
} from '../lib/types'
import { DataContext, type DataContextValue } from './data-context'

export const GUEST_DATA_STORAGE_KEY = 'mlf:guest-data:v1'
export const GUEST_DATA_CLEAR_EVENT = 'mlf:clear-guest-data'

const GUEST_USER_ID = 'guest-local'
const GUEST_EMAIL = 'guest@local'
const PERMANENT_MEAL_PLAN_DATE = '1970-01-01'

type GuestBibleChapterRead = {
  read_on: string
  book_order: number
  chapter: number
}

type GuestBibleTreeState = {
  progressSteps: number
  startedOn: string
  lastProcessedOn: string
}

type GuestData = {
  version: 1
  profile: Profile
  tasks: Task[]
  completions: TaskCompletion[]
  weightLogs: WeightLog[]
  foodHistoryLogs: FoodLog[]
  mealPlanEntries: MealPlanEntry[]
  bibleBookmarks: BibleBookmark[]
  bibleChapterReads: GuestBibleChapterRead[]
  bibleTreeState: GuestBibleTreeState | null
  pathDayConfirmations: PathDayConfirmation[]
  courseLessonCompletions: CourseLessonCompletion[]
  mindfulnessCategories: MindfulnessCategory[]
  mindfulnessNotes: MindfulnessNote[]
  savedProducts: SavedProduct[]
  savedExercises: SavedExercise[]
  scheduledExercises: ScheduledExercise[]
}

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${randomId}`
}

function createDefaultProfile(): Profile {
  return {
    id: GUEST_USER_ID,
    email: GUEST_EMAIL,
    weight_enabled: false,
    target_weight: null,
    desired_weight: null,
    weight_started_on: null,
    daily_calories_norm: null,
    theme: getSavedTheme(),
    font_scale: getSavedFontScale(),
    time_zone: null,
    city_name: null,
    city_latitude: null,
    city_longitude: null,
    shabbat_enabled: false,
    shabbat_theme: 'shabbat-dawn',
    annual_cycle_enabled: false,
    last_bible_book_order: null,
    last_bible_chapter: null,
    bible_chapter_positions: {},
    bible_bookmark_color_labels: {},
    diary_statistics_targets: {},
    negative_habits_pin: null,
    negative_habits_pin_required: true,
  }
}

function createInitialGuestData(): GuestData {
  const createdAt = new Date().toISOString()
  return {
    version: 1,
    profile: createDefaultProfile(),
    tasks: [],
    completions: [],
    weightLogs: [],
    foodHistoryLogs: [],
    mealPlanEntries: [],
    bibleBookmarks: [],
    bibleChapterReads: [],
    bibleTreeState: null,
    pathDayConfirmations: [],
    courseLessonCompletions: [],
    mindfulnessCategories: [
      {
        id: 'guest-category-sabbath-school',
        user_id: GUEST_USER_ID,
        name: 'Субботняя школа',
        created_at: createdAt,
      },
      {
        id: 'guest-category-unsorted',
        user_id: GUEST_USER_ID,
        name: 'Неотсортированные',
        created_at: createdAt,
      },
    ],
    mindfulnessNotes: [],
    savedProducts: [],
    savedExercises: [],
    scheduledExercises: [],
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function normalizeGuestData(value: unknown): GuestData {
  const defaults = createInitialGuestData()
  if (!value || typeof value !== 'object') return defaults

  const source = value as Partial<GuestData>
  const sourceProfile = source.profile && typeof source.profile === 'object'
    ? source.profile
    : defaults.profile
  const savedProducts = asArray<SavedProduct>(source.savedProducts).map((product) => ({
    ...product,
    user_id: GUEST_USER_ID,
    category: product.category ?? DEFAULT_PRODUCT_CATEGORY,
    is_favorite: product.is_favorite ?? false,
    proteins_per_100g: Number(product.proteins_per_100g) || 0,
    fats_per_100g: Number(product.fats_per_100g) || 0,
    carbohydrates_per_100g: Number(product.carbohydrates_per_100g) || 0,
  }))
  const productsByName = new Map(
    savedProducts.map((product) => [product.name.trim().toLocaleLowerCase('ru-RU'), product]),
  )
  const foodHistoryLogs = asArray<FoodLog>(source.foodHistoryLogs).map((food) => {
    const savedProduct = productsByName.get(food.product_name.trim().toLocaleLowerCase('ru-RU'))
    const lacksNutrition = !food.proteins_per_100g
      && !food.fats_per_100g
      && !food.carbohydrates_per_100g
    return {
      ...food,
      user_id: GUEST_USER_ID,
      proteins_per_100g: lacksNutrition ? savedProduct?.proteins_per_100g ?? 0 : food.proteins_per_100g,
      fats_per_100g: lacksNutrition ? savedProduct?.fats_per_100g ?? 0 : food.fats_per_100g,
      carbohydrates_per_100g: lacksNutrition
        ? savedProduct?.carbohydrates_per_100g ?? 0
        : food.carbohydrates_per_100g,
    }
  })

  return {
    version: 1,
    profile: {
      ...defaults.profile,
      ...sourceProfile,
      id: GUEST_USER_ID,
      email: GUEST_EMAIL,
      theme: normalizeTheme(sourceProfile.theme),
      font_scale: normalizeFontScale(sourceProfile.font_scale),
      shabbat_theme: normalizeShabbatTheme(sourceProfile.shabbat_theme),
      bible_chapter_positions: sourceProfile.bible_chapter_positions ?? {},
      bible_bookmark_color_labels: sourceProfile.bible_bookmark_color_labels ?? {},
      diary_statistics_targets: sourceProfile.diary_statistics_targets ?? {},
      negative_habits_pin_required: sourceProfile.negative_habits_pin_required !== false,
    },
    tasks: asArray<Task>(source.tasks).map((item) => ({ ...item, user_id: GUEST_USER_ID })),
    completions: asArray<TaskCompletion>(source.completions).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
    weightLogs: asArray<WeightLog>(source.weightLogs)
      .map((item) => ({ ...item, user_id: GUEST_USER_ID }))
      .sort((a, b) => b.logged_on.localeCompare(a.logged_on)),
    foodHistoryLogs,
    mealPlanEntries: asArray<MealPlanEntry>(source.mealPlanEntries).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
    bibleBookmarks: asArray<BibleBookmark>(source.bibleBookmarks).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
    bibleChapterReads: asArray<GuestBibleChapterRead>(source.bibleChapterReads),
    bibleTreeState: source.bibleTreeState ?? null,
    pathDayConfirmations: asArray<PathDayConfirmation>(source.pathDayConfirmations).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
    courseLessonCompletions: asArray<CourseLessonCompletion>(source.courseLessonCompletions).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
    mindfulnessCategories: asArray<MindfulnessCategory>(source.mindfulnessCategories).length
      ? asArray<MindfulnessCategory>(source.mindfulnessCategories).map((item) => ({
          ...item,
          user_id: GUEST_USER_ID,
        }))
      : defaults.mindfulnessCategories,
    mindfulnessNotes: asArray<MindfulnessNote>(source.mindfulnessNotes).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
    savedProducts,
    savedExercises: asArray<SavedExercise>(source.savedExercises).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
    scheduledExercises: asArray<ScheduledExercise>(source.scheduledExercises).map((item) => ({
      ...item,
      user_id: GUEST_USER_ID,
    })),
  }
}

function readGuestData() {
  try {
    const stored = window.localStorage.getItem(GUEST_DATA_STORAGE_KEY)
    return stored ? normalizeGuestData(JSON.parse(stored) as unknown) : createInitialGuestData()
  } catch {
    return createInitialGuestData()
  }
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function countBibleChapters(reads: GuestBibleChapterRead[], readOn: string) {
  return reads.filter((read) => read.read_on === readOn).length
}

function advanceBibleTree(data: GuestData, today = localISODate()): GuestData {
  if (!data.bibleTreeState) return data

  let processingDate = addDays(data.bibleTreeState.lastProcessedOn, 1)
  let progressSteps = data.bibleTreeState.progressSteps
  let changed = false
  while (processingDate < today) {
    const chapterCount = countBibleChapters(data.bibleChapterReads, processingDate)
    progressSteps = chapterCount >= 5
      ? Math.min(BIBLE_GROWTH_TOTAL_STEPS, progressSteps + 1)
      : Math.max(0, progressSteps - 1)
    processingDate = addDays(processingDate, 1)
    changed = true
  }

  if (!changed) return data
  return {
    ...data,
    bibleTreeState: {
      ...data.bibleTreeState,
      progressSteps,
      lastProcessedOn: addDays(today, -1),
    },
  }
}

function getBibleTreeProgress(data: GuestData, today = localISODate()): BibleTreeProgress {
  const advanced = advanceBibleTree(data, today)
  return {
    progressSteps: advanced.bibleTreeState?.progressSteps ?? 0,
    chaptersToday: countBibleChapters(advanced.bibleChapterReads, today),
    startedOn: advanced.bibleTreeState?.startedOn ?? null,
    available: true,
  }
}

function reconcileNutritionTaskDate(data: GuestData, loggedOn: string) {
  if (
    !data.profile.weight_enabled
    || data.profile.daily_calories_norm == null
    || loggedOn >= localISODate()
  ) return data

  const nutritionTasks = data.tasks.filter(isNutritionTask)
  if (!nutritionTasks.length) return data

  const totalCalories = data.foodHistoryLogs
    .filter((log) => log.logged_on === loggedOn)
    .reduce((sum, log) => sum + (log.weight_grams / 100) * log.calories_per_100g, 0)
  const nutritionTaskIds = new Set(nutritionTasks.map((task) => task.id))
  const otherCompletions = data.completions.filter((completion) => !(
    nutritionTaskIds.has(completion.task_id) && completion.completed_on === loggedOn
  ))

  if (totalCalories > data.profile.daily_calories_norm) {
    return otherCompletions.length === data.completions.length
      ? data
      : { ...data, completions: otherCompletions }
  }

  const automaticCompletions = nutritionTasks.map((task): TaskCompletion => ({
    id: createId('completion'),
    task_id: task.id,
    user_id: GUEST_USER_ID,
    completed_on: loggedOn,
  }))
  return { ...data, completions: [...otherCompletions, ...automaticCompletions] }
}

function sortProducts(products: SavedProduct[]) {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

function sortExercises(exercises: SavedExercise[]) {
  return [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

/**
 * Implements the same DataContext contract as DataProvider, but stores personal
 * data only in this browser. Supabase is used only for anonymous reads of public
 * Bible content through a client that cannot persist or refresh a user session.
 */
export function GuestDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GuestData>(() => {
    const initial = advanceBibleTree(readGuestData())
    return reconcileNutritionTaskDate(initial, addDays(localISODate(), -1))
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(GUEST_DATA_STORAGE_KEY, JSON.stringify(data))
    } catch (storageError) {
      console.error('Не удалось сохранить гостевые данные на этом устройстве.', storageError)
    }
  }, [data])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GUEST_DATA_STORAGE_KEY) return
      try {
        setData(event.newValue
          ? normalizeGuestData(JSON.parse(event.newValue) as unknown)
          : createInitialGuestData())
      } catch {
        setData(createInitialGuestData())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const clearGuestData = () => {
      window.localStorage.removeItem(GUEST_DATA_STORAGE_KEY)
      for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = window.sessionStorage.key(index)
        if (key?.startsWith('mlf:')) window.sessionStorage.removeItem(key)
      }
      setData(createInitialGuestData())
    }
    window.addEventListener(GUEST_DATA_CLEAR_EVENT, clearGuestData)
    return () => window.removeEventListener(GUEST_DATA_CLEAR_EVENT, clearGuestData)
  }, [])

  useEffect(() => {
    let timer: number
    const scheduleMidnightRefresh = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = window.setTimeout(() => {
        setData((current) => ({ ...advanceBibleTree(current) }))
        scheduleMidnightRefresh()
      }, nextMidnight.getTime() - now.getTime())
    }
    scheduleMidnightRefresh()
    return () => window.clearTimeout(timer)
  }, [])

  const refresh = useCallback(async () => {
    setData(advanceBibleTree(readGuestData()))
  }, [])

  const today = localISODate()
  const foodLogs = data.foodHistoryLogs.filter((food) => food.logged_on === today)
  const bibleTreeProgress = getBibleTreeProgress(data, today)

  const value = useMemo<DataContextValue>(() => ({
    profile: data.profile,
    tasks: data.tasks,
    completions: data.completions,
    weightLogs: data.weightLogs,
    foodLogs,
    foodHistoryLogs: data.foodHistoryLogs,
    mealPlanEntries: data.mealPlanEntries,
    bibleBookmarks: data.bibleBookmarks,
    bibleTreeProgress,
    pathDayConfirmations: data.pathDayConfirmations,
    courseLessonCompletions: data.courseLessonCompletions,
    mindfulnessCategories: data.mindfulnessCategories,
    mindfulnessNotes: data.mindfulnessNotes,
    savedProducts: data.savedProducts,
    savedExercises: data.savedExercises,
    scheduledExercises: data.scheduledExercises,
    loading: false,
    error: null,
    isAdmin: false,
    adminMode: false,
    setAdminMode() {},
    refresh,

    async completeToday(taskId) {
      const task = data.tasks.find((item) => item.id === taskId)
      if (data.profile.weight_enabled && task && isNutritionTask(task)) {
        throw new Error('Эта задача отмечается автоматически по дневной норме калорий')
      }
      if (data.completions.some((item) => item.task_id === taskId && item.completed_on === today)) return
      const completion: TaskCompletion = {
        id: createId('completion'),
        task_id: taskId,
        user_id: GUEST_USER_ID,
        completed_on: today,
      }
      setData((current) => ({ ...current, completions: [...current.completions, completion] }))
    },

    async addTask(title, habitDays, withdrawalSyndrome = false) {
      const task: Task = {
        id: createId('task'),
        user_id: GUEST_USER_ID,
        title,
        habit_days: habitDays,
        sort_order: data.tasks.length,
        withdrawal_syndrome: withdrawalSyndrome,
        withdrawal_started_on: withdrawalSyndrome ? today : null,
        withdrawal_restart_on: null,
        created_at: new Date().toISOString(),
      }
      setData((current) => ({ ...current, tasks: [...current.tasks, task] }))
    },

    async updateTask(id, patch) {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task),
      }))
    },

    async restartWithdrawalTask(taskId) {
      const restartOn = addDays(today, 1)
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => task.id === taskId
          ? { ...task, withdrawal_restart_on: restartOn }
          : task),
      }))
    },

    async deleteTask(id) {
      setData((current) => ({
        ...current,
        tasks: current.tasks.filter((task) => task.id !== id),
        completions: current.completions.filter((completion) => completion.task_id !== id),
      }))
    },

    async saveNegativeHabitsSecurity(patch) {
      if (patch.pin !== undefined && !/^\d{4}$/.test(patch.pin)) {
        throw new Error('PIN должен состоять из четырёх цифр')
      }
      setData((current) => ({
        ...current,
        profile: {
          ...current.profile,
          ...(patch.pin !== undefined ? { negative_habits_pin: patch.pin } : {}),
          ...(patch.requirePin !== undefined
            ? { negative_habits_pin_required: patch.requirePin }
            : {}),
        },
      }))
    },

    async saveWeightSettings(target) {
      setData((current) => ({
        ...current,
        profile: {
          ...current.profile,
          target_weight: target,
          weight_started_on: current.profile.weight_started_on ?? (target != null ? today : null),
        },
      }))
    },

    async saveWeightVisibility(enabled) {
      setData((current) => ({
        ...current,
        profile: { ...current.profile, weight_enabled: enabled },
      }))
    },

    async logTodayWeight(value) {
      const weight: WeightLog = {
        id: data.weightLogs.find((item) => item.logged_on === today)?.id ?? createId('weight'),
        user_id: GUEST_USER_ID,
        value,
        logged_on: today,
      }
      setData((current) => ({
        ...current,
        weightLogs: [weight, ...current.weightLogs.filter((item) => item.logged_on !== today)],
      }))
    },

    async saveCaloriesNorm(norm) {
      setData((current) => ({
        ...current,
        profile: { ...current.profile, daily_calories_norm: norm },
      }))
    },

    async saveDesiredWeight(desired) {
      setData((current) => ({
        ...current,
        profile: { ...current.profile, desired_weight: desired },
      }))
    },

    async saveDiaryStatisticsTargets(targets) {
      setData((current) => ({
        ...current,
        profile: { ...current.profile, diary_statistics_targets: targets },
      }))
    },

    async saveTheme(theme) {
      setData((current) => ({ ...current, profile: { ...current.profile, theme } }))
    },

    async saveFontScale(fontScale) {
      setData((current) => ({ ...current, profile: { ...current.profile, font_scale: fontScale } }))
    },

    async saveLocation(timeZone, city) {
      setData((current) => ({
        ...current,
        profile: {
          ...current.profile,
          time_zone: timeZone,
          city_name: city?.name ?? null,
          city_latitude: city?.latitude ?? null,
          city_longitude: city?.longitude ?? null,
        },
      }))
    },

    async saveAnnualCycleEnabled(enabled) {
      setData((current) => ({
        ...current,
        profile: { ...current.profile, annual_cycle_enabled: enabled },
      }))
    },

    async saveShabbatTheme(theme) {
      setData((current) => ({ ...current, profile: { ...current.profile, shabbat_theme: theme } }))
    },

    async saveBibleReadingPosition(bookOrder, chapter) {
      setData((current) => ({
        ...current,
        profile: {
          ...current.profile,
          last_bible_book_order: bookOrder,
          last_bible_chapter: chapter,
          bible_chapter_positions: {
            ...current.profile.bible_chapter_positions,
            [String(bookOrder)]: chapter,
          },
        },
      }))
    },

    async recordBibleChapterRead(bookOrder, chapter) {
      let next = advanceBibleTree(data, today)
      if (!next.bibleTreeState) {
        next = {
          ...next,
          bibleTreeState: {
            progressSteps: 0,
            startedOn: today,
            lastProcessedOn: addDays(today, -1),
          },
        }
      }
      if (!next.bibleChapterReads.some((read) => (
        read.read_on === today && read.book_order === bookOrder && read.chapter === chapter
      ))) {
        next = {
          ...next,
          bibleChapterReads: [
            ...next.bibleChapterReads,
            { read_on: today, book_order: bookOrder, chapter },
          ],
        }
      }
      setData(next)
      return getBibleTreeProgress(next, today)
    },

    async refreshBibleTreeProgress() {
      setData((current) => advanceBibleTree(current, today))
    },

    async addBibleBookmark(bookOrder, chapter, verse, title, color) {
      if (data.bibleBookmarks.some((bookmark) => (
        bookmark.book_order === bookOrder
        && bookmark.chapter === chapter
        && bookmark.verse === verse
      ))) {
        throw new Error('Закладка для этого стиха уже существует')
      }
      const bookmark: BibleBookmark = {
        id: createId('bookmark'),
        user_id: GUEST_USER_ID,
        book_order: bookOrder,
        chapter,
        verse,
        title: title.trim(),
        color,
        created_at: new Date().toISOString(),
      }
      setData((current) => ({
        ...current,
        bibleBookmarks: [bookmark, ...current.bibleBookmarks],
      }))
      return bookmark
    },

    async updateBibleBookmark(id, title, color) {
      setData((current) => ({
        ...current,
        bibleBookmarks: current.bibleBookmarks.map((bookmark) => bookmark.id === id
          ? { ...bookmark, title: title.trim(), color }
          : bookmark),
      }))
    },

    async deleteBibleBookmark(id) {
      setData((current) => ({
        ...current,
        bibleBookmarks: current.bibleBookmarks.filter((bookmark) => bookmark.id !== id),
      }))
    },

    async saveBibleBookmarkColorLabel(color, label) {
      setData((current) => {
        const labels = { ...current.profile.bible_bookmark_color_labels }
        const normalizedLabel = label.trim()
        if (normalizedLabel) labels[color] = normalizedLabel
        else delete labels[color]
        return {
          ...current,
          profile: { ...current.profile, bible_bookmark_color_labels: labels },
        }
      })
    },

    async getBibleChapter(bookOrder, chapter, includeTorahPortions = false): Promise<BibleVerse[]> {
      const { data: verses, error: selectError } = await requirePublicSupabase()
        .from(includeTorahPortions ? 'bible_verses_with_torah_markers' : 'bible_verses')
        .select('*')
        .eq('book_order', bookOrder)
        .eq('chapter', chapter)
        .order('verse')
      if (selectError) throw selectError
      return (verses ?? []) as BibleVerse[]
    },

    async getTorahPortions(bookOrder): Promise<TorahPortion[]> {
      const { data: portions, error: selectError } = await requirePublicSupabase()
        .from('torah_portions')
        .select('id, portion_number, name_en, name_he, name_ru, book_order, book_code, start_chapter, start_verse, end_chapter, end_verse')
        .eq('book_order', bookOrder)
        .order('portion_number')
      if (selectError) throw selectError
      return (portions ?? []) as TorahPortion[]
    },

    async confirmPathDay(day, cycleStartedOn) {
      if (data.pathDayConfirmations.some((item) => (
        item.day === day && item.cycle_started_on === cycleStartedOn
      ))) return
      const confirmation: PathDayConfirmation = {
        id: createId('path-day'),
        user_id: GUEST_USER_ID,
        cycle_started_on: cycleStartedOn,
        day,
      }
      setData((current) => ({
        ...current,
        pathDayConfirmations: [...current.pathDayConfirmations, confirmation],
      }))
    },

    async completeCourseLesson(courseId, lessonNumber) {
      if (data.courseLessonCompletions.some((item) => (
        item.course_id === courseId && item.lesson_number === lessonNumber
      ))) return
      const completion: CourseLessonCompletion = {
        id: createId('course-lesson'),
        user_id: GUEST_USER_ID,
        course_id: courseId,
        lesson_number: lessonNumber,
      }
      setData((current) => ({
        ...current,
        courseLessonCompletions: [...current.courseLessonCompletions, completion],
      }))
    },

    async addMindfulnessCategory(name) {
      const normalizedName = name.trim()
      if (data.mindfulnessCategories.some((category) => category.name === normalizedName)) {
        throw new Error('Категория с таким названием уже существует')
      }
      const category: MindfulnessCategory = {
        id: createId('mindfulness-category'),
        user_id: GUEST_USER_ID,
        name: normalizedName,
        created_at: new Date().toISOString(),
      }
      setData((current) => ({
        ...current,
        mindfulnessCategories: [...current.mindfulnessCategories, category],
      }))
      return category
    },

    async deleteMindfulnessCategory(id, destinationCategoryId) {
      setData((current) => ({
        ...current,
        mindfulnessCategories: current.mindfulnessCategories.filter((category) => category.id !== id),
        mindfulnessNotes: current.mindfulnessNotes.map((note) => note.category_id === id
          ? { ...note, category_id: destinationCategoryId, updated_at: new Date().toISOString() }
          : note),
      }))
    },

    async addMindfulnessNote(title, content, categoryId) {
      const now = new Date().toISOString()
      const note: MindfulnessNote = {
        id: createId('mindfulness-note'),
        user_id: GUEST_USER_ID,
        category_id: categoryId,
        title,
        content,
        created_at: now,
        updated_at: now,
      }
      setData((current) => ({ ...current, mindfulnessNotes: [note, ...current.mindfulnessNotes] }))
      return note
    },

    async updateMindfulnessNote(id, title, content, categoryId) {
      const updatedAt = new Date().toISOString()
      setData((current) => {
        const updated = current.mindfulnessNotes.find((note) => note.id === id)
        if (!updated) return current
        const next = { ...updated, title, content, category_id: categoryId, updated_at: updatedAt }
        return {
          ...current,
          mindfulnessNotes: [next, ...current.mindfulnessNotes.filter((note) => note.id !== id)],
        }
      })
    },

    async deleteMindfulnessNote(id) {
      setData((current) => ({
        ...current,
        mindfulnessNotes: current.mindfulnessNotes.filter((note) => note.id !== id),
      }))
    },

    async logFoodToday(productName, weightGrams, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g) {
      const food: FoodLog = {
        id: createId('food'),
        user_id: GUEST_USER_ID,
        logged_on: today,
        product_name: productName,
        weight_grams: weightGrams,
        calories_per_100g: caloriesPer100g,
        proteins_per_100g: proteinsPer100g,
        fats_per_100g: fatsPer100g,
        carbohydrates_per_100g: carbohydratesPer100g,
      }
      setData((current) => ({
        ...current,
        foodHistoryLogs: [...current.foodHistoryLogs, food],
      }))
    },

    async logFoodOnDate(loggedOn, productName, weightGrams, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g) {
      if (loggedOn >= today) throw new Error('Выберите прошедшую календарную дату')
      const food: FoodLog = {
        id: createId('food'),
        user_id: GUEST_USER_ID,
        logged_on: loggedOn,
        product_name: productName,
        weight_grams: weightGrams,
        calories_per_100g: caloriesPer100g,
        proteins_per_100g: proteinsPer100g,
        fats_per_100g: fatsPer100g,
        carbohydrates_per_100g: carbohydratesPer100g,
      }
      setData((current) => reconcileNutritionTaskDate({
        ...current,
        foodHistoryLogs: [...current.foodHistoryLogs, food],
      }, loggedOn))
    },

    async updateFoodLogProductName(id, productName) {
      setData((current) => {
        const updated = current.foodHistoryLogs.find((food) => food.id === id)
        if (!updated) return current
        const next = {
          ...current,
          foodHistoryLogs: current.foodHistoryLogs.map((food) => food.id === id
            ? { ...food, product_name: productName }
            : food),
        }
        return reconcileNutritionTaskDate(next, updated.logged_on)
      })
    },

    async deleteFoodLog(id) {
      setData((current) => {
        const deleted = current.foodHistoryLogs.find((food) => food.id === id)
        const next = {
          ...current,
          foodHistoryLogs: current.foodHistoryLogs.filter((food) => food.id !== id),
        }
        return deleted ? reconcileNutritionTaskDate(next, deleted.logged_on) : next
      })
    },

    async addMealPlanEntry(mealType, productName, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g) {
      const entry: MealPlanEntry = {
        id: createId('meal-plan'),
        user_id: GUEST_USER_ID,
        planned_on: PERMANENT_MEAL_PLAN_DATE,
        meal_type: mealType,
        product_name: productName,
        weight_grams: 100,
        calories_per_100g: caloriesPer100g,
        proteins_per_100g: proteinsPer100g,
        fats_per_100g: fatsPer100g,
        carbohydrates_per_100g: carbohydratesPer100g,
        created_at: new Date().toISOString(),
      }
      setData((current) => ({
        ...current,
        mealPlanEntries: [...current.mealPlanEntries, entry],
      }))
    },

    async deleteMealPlanEntry(id) {
      setData((current) => ({
        ...current,
        mealPlanEntries: current.mealPlanEntries.filter((entry) => entry.id !== id),
      }))
    },

    async addSavedProduct(name, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g, category, isFavorite) {
      if (data.savedProducts.some((product) => product.name === name)) {
        throw new Error('Продукт с таким названием уже существует')
      }
      const product: SavedProduct = {
        id: createId('product'),
        user_id: GUEST_USER_ID,
        name,
        calories_per_100g: caloriesPer100g,
        proteins_per_100g: proteinsPer100g,
        fats_per_100g: fatsPer100g,
        carbohydrates_per_100g: carbohydratesPer100g,
        category: category as ProductCategory,
        is_favorite: isFavorite,
      }
      setData((current) => ({
        ...current,
        savedProducts: sortProducts([...current.savedProducts, product]),
      }))
    },

    async updateSavedProduct(id, name, caloriesPer100g, proteinsPer100g, fatsPer100g, carbohydratesPer100g, category, isFavorite) {
      setData((current) => ({
        ...current,
        savedProducts: sortProducts(current.savedProducts.map((product) => product.id === id
          ? {
              ...product,
              name,
              calories_per_100g: caloriesPer100g,
              proteins_per_100g: proteinsPer100g,
              fats_per_100g: fatsPer100g,
              carbohydrates_per_100g: carbohydratesPer100g,
              category,
              is_favorite: isFavorite,
            }
          : product)),
      }))
    },

    async setSavedProductFavorite(id, isFavorite) {
      setData((current) => ({
        ...current,
        savedProducts: current.savedProducts.map((product) => product.id === id
          ? { ...product, is_favorite: isFavorite }
          : product),
      }))
    },

    async deleteSavedProduct(id) {
      setData((current) => ({
        ...current,
        savedProducts: current.savedProducts.filter((product) => product.id !== id),
      }))
    },

    async addSavedExercise(name, category, exerciseType, restTimerEnabled) {
      if (data.savedExercises.some((exercise) => exercise.name === name && exercise.category === category)) {
        throw new Error('Упражнение с таким названием уже существует')
      }
      const exercise: SavedExercise = {
        id: createId('exercise'),
        user_id: GUEST_USER_ID,
        name,
        category,
        exercise_type: exerciseType,
        rest_timer_enabled: restTimerEnabled,
      }
      setData((current) => ({
        ...current,
        savedExercises: sortExercises([...current.savedExercises, exercise]),
      }))
    },

    async updateSavedExercise(id, name, exerciseType, restTimerEnabled) {
      setData((current) => ({
        ...current,
        savedExercises: sortExercises(current.savedExercises.map((exercise) => exercise.id === id
          ? {
              ...exercise,
              name,
              exercise_type: exerciseType,
              rest_timer_enabled: restTimerEnabled,
            }
          : exercise)),
      }))
    },

    async deleteSavedExercise(id) {
      setData((current) => ({
        ...current,
        savedExercises: current.savedExercises.filter((exercise) => exercise.id !== id),
      }))
    },

    async scheduleExercise(plannedOn, exercise) {
      const scheduled: ScheduledExercise = {
        id: createId('scheduled-exercise'),
        user_id: GUEST_USER_ID,
        planned_on: plannedOn,
        exercise_name: exercise.name,
        category: exercise.category,
        exercise_type: exercise.exercise_type,
        rest_timer_enabled: exercise.rest_timer_enabled,
        sort_order: data.scheduledExercises.filter((item) => item.planned_on === plannedOn).length,
        weight_kg: null,
        repetitions: null,
        sets: null,
        rest_duration: null,
        parameters_locked: false,
        completed: false,
      }
      setData((current) => ({
        ...current,
        scheduledExercises: [...current.scheduledExercises, scheduled],
      }))
    },

    async deleteScheduledExercise(id) {
      setData((current) => ({
        ...current,
        scheduledExercises: current.scheduledExercises.filter((exercise) => exercise.id !== id),
      }))
    },

    async moveScheduledExercise(id, direction) {
      setData((current) => {
        const selected = current.scheduledExercises.find((exercise) => exercise.id === id)
        if (!selected) return current
        const dayExercises = current.scheduledExercises
          .filter((exercise) => exercise.planned_on === selected.planned_on)
          .sort((a, b) => a.sort_order - b.sort_order)
        const index = dayExercises.findIndex((exercise) => exercise.id === id)
        const target = dayExercises[index + (direction === 'up' ? -1 : 1)]
        if (!target) return current
        return {
          ...current,
          scheduledExercises: current.scheduledExercises.map((exercise) => {
            if (exercise.id === selected.id) return { ...exercise, sort_order: target.sort_order }
            if (exercise.id === target.id) return { ...exercise, sort_order: selected.sort_order }
            return exercise
          }),
        }
      })
    },

    async updateScheduledExercise(id, patch) {
      setData((current) => ({
        ...current,
        scheduledExercises: current.scheduledExercises.map((exercise) => exercise.id === id
          ? { ...exercise, ...patch }
          : exercise),
      }))
    },
  }), [bibleTreeProgress, data, foodLogs, refresh, today])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
