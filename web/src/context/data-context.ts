import { createContext } from 'react'
import type {
  ExerciseCategory,
  ExerciseType,
  CourseLessonCompletion,
  BibleVerse,
  FoodLog,
  MindfulnessNote,
  PathDay,
  PathDayConfirmation,
  Profile,
  ScheduledExercise,
  SavedExercise,
  SavedProduct,
  Task,
  TaskCompletion,
  WeightLog,
} from '../lib/types'
import type { FontScale, ShabbatThemeId, ThemeId } from '../lib/theme'
import type { ProductCategory } from '../lib/product-categories'
import type { SunsetCity } from '../lib/sunset'

export type DataContextValue = {
  profile: Profile | null
  tasks: Task[]
  completions: TaskCompletion[]
  weightLogs: WeightLog[]
  foodLogs: FoodLog[]
  foodHistoryLogs: FoodLog[]
  pathDayConfirmations: PathDayConfirmation[]
  courseLessonCompletions: CourseLessonCompletion[]
  mindfulnessNotes: MindfulnessNote[]
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
  saveLocation: (timeZone: string, city: SunsetCity | null) => Promise<void>
  saveShabbatEnabled: (enabled: boolean) => Promise<void>
  saveAnnualCycleEnabled: (enabled: boolean) => Promise<void>
  saveShabbatTheme: (theme: ShabbatThemeId) => Promise<void>
  getBibleChapter: (bookOrder: number, chapter: number) => Promise<BibleVerse[]>
  confirmPathDay: (day: PathDay, cycleStartedOn: string) => Promise<void>
  completeCourseLesson: (courseId: string, lessonNumber: number) => Promise<void>
  addMindfulnessNote: (title: string, content: string) => Promise<void>
  updateMindfulnessNote: (id: string, title: string, content: string) => Promise<void>
  deleteMindfulnessNote: (id: string) => Promise<void>
  logFoodToday: (productName: string, weightGrams: number, caloriesPer100g: number, proteinsPer100g: number, fatsPer100g: number, carbohydratesPer100g: number) => Promise<void>
  deleteFoodLog: (id: string) => Promise<void>
  addSavedProduct: (name: string, caloriesPer100g: number, proteinsPer100g: number, fatsPer100g: number, carbohydratesPer100g: number, category: ProductCategory, isFavorite: boolean) => Promise<void>
  updateSavedProduct: (id: string, name: string, caloriesPer100g: number, proteinsPer100g: number, fatsPer100g: number, carbohydratesPer100g: number, category: ProductCategory, isFavorite: boolean) => Promise<void>
  setSavedProductFavorite: (id: string, isFavorite: boolean) => Promise<void>
  deleteSavedProduct: (id: string) => Promise<void>
  addSavedExercise: (name: string, category: ExerciseCategory, exerciseType: ExerciseType, restTimerEnabled: boolean) => Promise<void>
  updateSavedExercise: (id: string, name: string, exerciseType: ExerciseType, restTimerEnabled: boolean) => Promise<void>
  deleteSavedExercise: (id: string) => Promise<void>
  scheduleExercise: (plannedOn: string, exercise: SavedExercise) => Promise<void>
  deleteScheduledExercise: (id: string) => Promise<void>
  moveScheduledExercise: (id: string, direction: 'up' | 'down') => Promise<void>
  updateScheduledExercise: (id: string, patch: { weight_kg?: number | null; repetitions?: number | null; sets?: number | null; rest_duration?: string | null; parameters_locked?: boolean; completed?: boolean }) => Promise<void>
}

export const DataContext = createContext<DataContextValue | null>(null)
