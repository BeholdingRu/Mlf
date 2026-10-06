import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useData } from '../hooks/useData'
import type { DiaryStatisticsTargets, SavedProduct } from '../lib/types'
import {
  dateTimeInputInTimeZone,
  getAdminTestTime,
  getSavedAdminTestDateTime,
  isAdminTestTimeRunning,
  saveAdminTestDateTime,
  startAdminTestTime,
} from '../lib/admin-test-time'
import { localISODate, parseISODate } from '../lib/dates'
import { getCalorieAdaptation } from '../lib/calorie-adaptation'
import { isNutritionTask } from '../lib/nutrition-task'
import { getSunsetTime } from '../lib/sunset'
import { getRegularTaskProgress } from '../lib/task-progress'
import { ExerciseStatistics } from './ExerciseStatistics'

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const QUICK_NUTRITION_PERIOD_DAYS = [7, 14, 21, 28, 56] as const

type QuickNutritionPeriodDays = typeof QUICK_NUTRITION_PERIOD_DAYS[number]
type NutritionPeriodPreset = QuickNutritionPeriodDays | 'current-month'

type StatisticsNumericTargetKey =
  | 'carbohydrates'
  | 'weight7Days'
  | 'weight14Days'
  | 'weight28Days'

type StatisticsTargetForm = Record<StatisticsNumericTargetKey, string> & {
  calculateMacroCalories: boolean
}

type MacroProductFilter = 'proteins' | 'fats' | 'carbohydrates'

type MacroCalculatorSettings = {
  fatCaloriesPercent: number
  proteinWeightMultiplier: number
}

type MacroCalculatorSettingsForm = {
  fatCaloriesPercent: string
  proteinWeightMultiplier: string
}

type MacroCalculatorBalanceValues = {
  proteins: number | null
  fats: number | null
}

type MacroCalculatorTargetValues = {
  calories: number | null
  proteins: number | null
  fats: number | null
  carbohydrates: number | null
}

const DEFAULT_MACRO_CALCULATOR_SETTINGS: MacroCalculatorSettings = {
  fatCaloriesPercent: 30,
  proteinWeightMultiplier: 1.4,
}

export function DiaryView() {
  const {
    adminMode,
    tasks,
    completions,
    foodHistoryLogs,
    weightLogs,
    scheduledExercises,
    savedProducts,
    profile,
    saveDiaryStatisticsTargets,
    logFoodOnDate,
    updateFoodLogProductName,
    deleteFoodLog,
  } = useData()
  const actualToday = localISODate()
  const [testDateTime, setTestDateTime] = useState(
    () => getSavedAdminTestDateTime() || dateTimeInputInTimeZone(new Date(), profile?.time_zone),
  )
  const [testTimeRunning, setTestTimeRunning] = useState(isAdminTestTimeRunning)
  const datesWithRecords = useMemo(
    () => new Set([...foodHistoryLogs, ...weightLogs].map((record) => record.logged_on)),
    [foodHistoryLogs, weightLogs],
  )
  const datesWithMissedTasks = useMemo(
    () => new Set(
      tasks
        .filter(isNutritionTask)
        .flatMap((task) => getRegularTaskProgress(task, completions, actualToday, profile?.time_zone).missedDates),
    ),
    [actualToday, completions, profile?.time_zone, tasks],
  )
  const datesWithTraining = useMemo(
    () => new Set(scheduledExercises.map((exercise) => exercise.planned_on)),
    [scheduledExercises],
  )
  const latestDate = [...foodHistoryLogs, ...weightLogs].reduce<string | null>(
    (latest, record) => (!latest || record.logged_on > latest ? record.logged_on : latest),
    null,
  )
  const earliestDate = [...foodHistoryLogs, ...weightLogs].reduce<string | null>(
    (earliest, record) => (!earliest || record.logged_on < earliest ? record.logged_on : earliest),
    null,
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null)
  const [showProducts, setShowProducts] = useState(false)
  const [showNutritionStatistics, setShowNutritionStatistics] = useState(false)
  const [showNutritionPeriod, setShowNutritionPeriod] = useState(false)
  const [showNutritionPeriodDetails, setShowNutritionPeriodDetails] = useState(false)
  const [showMonthSummary, setShowMonthSummary] = useState(false)
  const [showStatisticsSettings, setShowStatisticsSettings] = useState(false)
  const [showWeightTargetInfo, setShowWeightTargetInfo] = useState(false)
  const [activeMacroProductFilter, setActiveMacroProductFilter] = useState<MacroProductFilter | null>(null)
  const [macroProductSortDirection, setMacroProductSortDirection] = useState<'desc' | 'asc'>('desc')
  const [proteinBalanceSort, setProteinBalanceSort] = useState(false)
  const [statisticsTargetForm, setStatisticsTargetForm] = useState<StatisticsTargetForm>(
    () => statisticsTargetsToForm(profile?.diary_statistics_targets),
  )
  const [macroCalculatorSettings, setMacroCalculatorSettings] = useState(
    () => macroCalculatorSettingsFromTargets(profile?.diary_statistics_targets),
  )
  const [macroCalculatorSettingsForm, setMacroCalculatorSettingsForm] = useState<MacroCalculatorSettingsForm>(
    () => macroCalculatorSettingsToForm(macroCalculatorSettingsFromTargets(profile?.diary_statistics_targets)),
  )
  const [macroCalculatorBalanceValues, setMacroCalculatorBalanceValues] = useState<MacroCalculatorBalanceValues>({
    proteins: null,
    fats: null,
  })
  const [macroCalculatorTargetValues, setMacroCalculatorTargetValues] = useState<MacroCalculatorTargetValues>({
    calories: null,
    proteins: null,
    fats: null,
    carbohydrates: null,
  })
  const [statisticsSettingsBusy, setStatisticsSettingsBusy] = useState(false)
  const [statisticsSettingsError, setStatisticsSettingsError] = useState<string | null>(null)
  const [nutritionCalendarSelection, setNutritionCalendarSelection] = useState<'start' | 'end'>('start')
  const [nutritionPeriodPreset, setNutritionPeriodPreset] = useState<NutritionPeriodPreset | null>('current-month')
  const [nutritionPeriodFrom, setNutritionPeriodFrom] = useState(() => {
    const today = parseISODate(actualToday)
    return localISODate(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [nutritionPeriodTo, setNutritionPeriodTo] = useState(actualToday)
  const [showExercises, setShowExercises] = useState(false)
  const [showTrainingStatistics, setShowTrainingStatistics] = useState(false)
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null)
  const [editingFoodName, setEditingFoodName] = useState('')
  const [foodNameEditBusy, setFoodNameEditBusy] = useState(false)
  const [foodNameEditError, setFoodNameEditError] = useState<string | null>(null)
  const [deletingFoodId, setDeletingFoodId] = useState<string | null>(null)
  const [deleteFoodError, setDeleteFoodError] = useState<string | null>(null)
  const [adminFoodFormOpen, setAdminFoodFormOpen] = useState(false)
  const [adminSavedProductId, setAdminSavedProductId] = useState('')
  const [adminFoodName, setAdminFoodName] = useState('')
  const [adminFoodWeight, setAdminFoodWeight] = useState('')
  const [adminFoodCalories, setAdminFoodCalories] = useState('')
  const [adminFoodProteins, setAdminFoodProteins] = useState('')
  const [adminFoodFats, setAdminFoodFats] = useState('')
  const [adminFoodCarbohydrates, setAdminFoodCarbohydrates] = useState('')
  const [adminFoodBusy, setAdminFoodBusy] = useState(false)
  const [adminFoodError, setAdminFoodError] = useState<string | null>(null)

  useEffect(() => {
    if (!showMonthSummary && !showNutritionPeriodDetails) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMonthSummary(false)
        setShowNutritionPeriodDetails(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showMonthSummary, showNutritionPeriodDetails])

  const statisticsTargets = profile?.diary_statistics_targets ?? {}
  const { effectiveNorm: effectiveDailyCaloriesNorm } = getCalorieAdaptation(profile, weightLogs)
  const calculatedProteinTarget = typeof profile?.desired_weight === 'number' && profile.desired_weight > 0
    ? profile.desired_weight * macroCalculatorSettings.proteinWeightMultiplier
    : undefined
  const calculatedFatTarget = typeof effectiveDailyCaloriesNorm === 'number' && effectiveDailyCaloriesNorm > 0
    ? (effectiveDailyCaloriesNorm * (macroCalculatorSettings.fatCaloriesPercent / 100)) / 9
    : undefined
  const defaultCarbohydrateTarget = typeof effectiveDailyCaloriesNorm === 'number'
    && effectiveDailyCaloriesNorm > 0
    && calculatedProteinTarget !== undefined
    && calculatedFatTarget !== undefined
    ? (effectiveDailyCaloriesNorm - calculatedProteinTarget * 4 - calculatedFatTarget * 9) / 4
    : undefined
  const calculatedCarbohydrateTarget = hasTarget(statisticsTargets.carbohydrates)
    ? statisticsTargets.carbohydrates
    : typeof defaultCarbohydrateTarget === 'number' && defaultCarbohydrateTarget > 0
      ? defaultCarbohydrateTarget
      : undefined
  const proteinBalanceAvailable = typeof macroCalculatorBalanceValues.proteins === 'number'
    && macroCalculatorBalanceValues.proteins > 0
    && typeof macroCalculatorBalanceValues.fats === 'number'
    && macroCalculatorBalanceValues.fats > 0
  const filteredSavedProducts = useMemo(() => {
    if (!activeMacroProductFilter) return []

    const calculatorProteins = macroCalculatorBalanceValues.proteins
    const calculatorFats = macroCalculatorBalanceValues.fats
    const products = savedProducts.filter(
      (product) => getSavedProductMacro(product, activeMacroProductFilter) > 0,
    )

    if (
      activeMacroProductFilter === 'proteins'
      && proteinBalanceSort
      && typeof calculatorProteins === 'number'
      && calculatorProteins > 0
      && typeof calculatorFats === 'number'
      && calculatorFats > 0
    ) {
      return products.sort((first, second) => {
        const balanceDifference = getProteinFatBalanceDeviation(
          first,
          calculatorProteins,
          calculatorFats,
        ) - getProteinFatBalanceDeviation(
          second,
          calculatorProteins,
          calculatorFats,
        )
        return balanceDifference
          || second.proteins_per_100g - first.proteins_per_100g
          || first.name.localeCompare(second.name, 'ru-RU')
      })
    }

    return products.sort((first, second) => {
      const difference = getSavedProductMacro(second, activeMacroProductFilter)
        - getSavedProductMacro(first, activeMacroProductFilter)
      return (macroProductSortDirection === 'desc' ? difference : -difference)
        || first.name.localeCompare(second.name, 'ru-RU')
    })
  }, [
    activeMacroProductFilter,
    macroProductSortDirection,
    macroCalculatorBalanceValues,
    proteinBalanceSort,
    savedProducts,
  ])

  const toggleMacroProductFilter = (filter: MacroProductFilter) => {
    if (activeMacroProductFilter === filter) {
      setActiveMacroProductFilter(null)
      setProteinBalanceSort(false)
      return
    }
    setMacroProductSortDirection('desc')
    setProteinBalanceSort(false)
    setActiveMacroProductFilter(filter)
  }

  const testDate = testDateTime.slice(0, 10)
  const activeSelectedDate = selectedDate ?? (adminMode && testDate ? testDate : latestDate)
  const activeMonth = visibleMonth ?? (() => {
    const initialDate = adminMode && testDate ? testDate : latestDate
    const date = initialDate ? parseISODate(initialDate) : new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })()

  const selectedLogs = activeSelectedDate
    ? foodHistoryLogs.filter((food) => food.logged_on === activeSelectedDate)
    : []
  const selectedWeight = activeSelectedDate
    ? weightLogs.find((weight) => weight.logged_on === activeSelectedDate) ?? null
    : null
  const plannedExercises = activeSelectedDate
    ? scheduledExercises
      .filter((exercise) => exercise.planned_on === activeSelectedDate)
      .sort((a, b) => a.sort_order - b.sort_order)
    : []
  const completedExercises = plannedExercises.filter((exercise) => exercise.completed)
  const totalWorkedWeight = completedExercises.reduce(
    (total, exercise) => total + (getWorkedWeight(exercise) ?? 0),
    0,
  )
  const totalCalories = selectedLogs.reduce(
    (sum, food) => sum + (food.weight_grams / 100) * food.calories_per_100g,
    0,
  )
  const totalNutrition = selectedLogs.reduce(
    (totals, food) => {
      const multiplier = food.weight_grams / 100
      return {
        proteins: totals.proteins + multiplier * food.proteins_per_100g,
        fats: totals.fats + multiplier * food.fats_per_100g,
        carbohydrates: totals.carbohydrates + multiplier * food.carbohydrates_per_100g,
      }
    },
    { proteins: 0, fats: 0, carbohydrates: 0 },
  )
  const nutritionPeriodStatistics = useMemo(() => {
    if (!nutritionPeriodFrom || !nutritionPeriodTo || nutritionPeriodFrom > nutritionPeriodTo) return null

    const totalsByDate = new Map<string, {
      calories: number
      proteins: number
      fats: number
      carbohydrates: number
    }>()

    foodHistoryLogs.forEach((food) => {
      if (food.logged_on < nutritionPeriodFrom || food.logged_on > nutritionPeriodTo) return

      const multiplier = food.weight_grams / 100
      const totals = totalsByDate.get(food.logged_on) ?? {
        calories: 0,
        proteins: 0,
        fats: 0,
        carbohydrates: 0,
      }
      totals.calories += multiplier * food.calories_per_100g
      totals.proteins += multiplier * food.proteins_per_100g
      totals.fats += multiplier * food.fats_per_100g
      totals.carbohydrates += multiplier * food.carbohydrates_per_100g
      totalsByDate.set(food.logged_on, totals)
    })

    const trackedDays = totalsByDate.size
    if (trackedDays === 0) {
      return { trackedDays, calories: 0, proteins: 0, fats: 0, carbohydrates: 0 }
    }

    const periodTotals = [...totalsByDate.values()].reduce(
      (totals, day) => ({
        calories: totals.calories + day.calories,
        proteins: totals.proteins + day.proteins,
        fats: totals.fats + day.fats,
        carbohydrates: totals.carbohydrates + day.carbohydrates,
      }),
      { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 },
    )

    return {
      trackedDays,
      calories: periodTotals.calories / trackedDays,
      proteins: periodTotals.proteins / trackedDays,
      fats: periodTotals.fats / trackedDays,
      carbohydrates: periodTotals.carbohydrates / trackedDays,
    }
  }, [foodHistoryLogs, nutritionPeriodFrom, nutritionPeriodTo])
  const weightPeriodStatistics = useMemo(() => {
    if (!nutritionPeriodFrom || !nutritionPeriodTo || nutritionPeriodFrom > nutritionPeriodTo) return null

    const selectedDays = Math.round(
      (parseISODate(nutritionPeriodTo).getTime() - parseISODate(nutritionPeriodFrom).getTime())
      / (24 * 60 * 60 * 1000),
    ) + 1

    const periodLogs = weightLogs
      .filter((log) => log.logged_on >= nutritionPeriodFrom && log.logged_on <= nutritionPeriodTo)
      .sort((a, b) => a.logged_on.localeCompare(b.logged_on))
    const firstLog = periodLogs[0]
    const lastLog = periodLogs[periodLogs.length - 1]
    if (!firstLog || !lastLog || firstLog.logged_on === lastLog.logged_on) return null

    const elapsedDays = Math.round(
      (parseISODate(lastLog.logged_on).getTime() - parseISODate(firstLog.logged_on).getTime())
      / (24 * 60 * 60 * 1000),
    )
    if (elapsedDays < 1) return null

    return {
      averageDailyChange: (lastLog.value - firstLog.value) / elapsedDays,
      firstDate: firstLog.logged_on,
      lastDate: lastLog.logged_on,
      measurements: periodLogs.length,
      selectedDays,
      elapsedDays,
    }
  }, [nutritionPeriodFrom, nutritionPeriodTo, weightLogs])
  const sevenDayWeightTrendColor = weightPeriodStatistics
    && weightPeriodStatistics.selectedDays >= 7
    && hasTarget(statisticsTargets.weight7Days)
    ? getTargetDeviationColor(
        weightPeriodStatistics.averageDailyChange * 7,
        statisticsTargets.weight7Days,
      )
    : undefined
  const nutritionPeriodDetails = useMemo(() => {
    if (!nutritionPeriodFrom || !nutritionPeriodTo || nutritionPeriodFrom > nutritionPeriodTo) return []

    const rowsByDate = new Map<string, {
      date: string
      weight: number | null
      hasNutrition: boolean
      calories: number
      proteins: number
      fats: number
      carbohydrates: number
    }>()
    const getRow = (date: string) => {
      const existing = rowsByDate.get(date)
      if (existing) return existing
      const row = {
        date,
        weight: null,
        hasNutrition: false,
        calories: 0,
        proteins: 0,
        fats: 0,
        carbohydrates: 0,
      }
      rowsByDate.set(date, row)
      return row
    }

    foodHistoryLogs.forEach((food) => {
      if (food.logged_on < nutritionPeriodFrom || food.logged_on > nutritionPeriodTo) return
      const row = getRow(food.logged_on)
      const multiplier = food.weight_grams / 100
      row.hasNutrition = true
      row.calories += multiplier * food.calories_per_100g
      row.proteins += multiplier * food.proteins_per_100g
      row.fats += multiplier * food.fats_per_100g
      row.carbohydrates += multiplier * food.carbohydrates_per_100g
    })
    weightLogs.forEach((weight) => {
      if (weight.logged_on < nutritionPeriodFrom || weight.logged_on > nutritionPeriodTo) return
      getRow(weight.logged_on).weight = weight.value
    })

    return [...rowsByDate.values()].sort((first, second) => first.date.localeCompare(second.date))
  }, [foodHistoryLogs, nutritionPeriodFrom, nutritionPeriodTo, weightLogs])
  const nutritionPeriodDetailAverages = useMemo(() => {
    const weightRows = nutritionPeriodDetails.filter((row) => row.weight !== null)
    const nutritionRows = nutritionPeriodDetails.filter((row) => row.hasNutrition)
    const nutritionDayCount = nutritionRows.length
    const weightValues = weightRows.map((row) => row.weight as number)
    const firstWeight = weightValues[0] ?? null
    const lastWeight = weightValues[weightValues.length - 1] ?? null

    return {
      firstWeight,
      lastWeight,
      weightDecreased: firstWeight !== null && lastWeight !== null && lastWeight < firstWeight,
      calories: nutritionDayCount > 0
        ? nutritionRows.reduce((sum, row) => sum + row.calories, 0) / nutritionDayCount
        : null,
      proteins: nutritionDayCount > 0
        ? nutritionRows.reduce((sum, row) => sum + row.proteins, 0) / nutritionDayCount
        : null,
      fats: nutritionDayCount > 0
        ? nutritionRows.reduce((sum, row) => sum + row.fats, 0) / nutritionDayCount
        : null,
      carbohydrates: nutritionDayCount > 0
        ? nutritionRows.reduce((sum, row) => sum + row.carbohydrates, 0) / nutritionDayCount
        : null,
    }
  }, [nutritionPeriodDetails])
  const targetWeightAtPeriodEnd = nutritionPeriodDetailAverages.firstWeight !== null
    && weightPeriodStatistics
    && hasTarget(statisticsTargets.weight7Days)
    ? nutritionPeriodDetailAverages.firstWeight
      + (statisticsTargets.weight7Days / 7) * weightPeriodStatistics.elapsedDays
    : null
  const firstWeekday = (activeMonth.getDay() + 6) % 7
  const daysInMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate()
  const emptyDays = Array.from({ length: firstWeekday })
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => index + 1)
  const statisticsMonthStart = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1))
  const statisticsMonthEnd = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), daysInMonth))
  const monthSummary = (() => {
    const monthFoodLogs = foodHistoryLogs.filter(
      (food) => food.logged_on >= statisticsMonthStart && food.logged_on <= statisticsMonthEnd,
    )
    const monthWeightLogs = weightLogs
      .filter((log) => log.logged_on >= statisticsMonthStart && log.logged_on <= statisticsMonthEnd)
      .sort((a, b) => a.logged_on.localeCompare(b.logged_on))
    const monthCompletedExercises = scheduledExercises.filter(
      (exercise) => exercise.completed
        && exercise.planned_on >= statisticsMonthStart
        && exercise.planned_on <= statisticsMonthEnd,
    )

    const calories = monthFoodLogs.reduce(
      (sum, food) => sum + (food.weight_grams / 100) * food.calories_per_100g,
      0,
    )
    const firstWeight = monthWeightLogs[0]
    const lastWeight = monthWeightLogs[monthWeightLogs.length - 1]
    const weightChange = firstWeight && lastWeight && firstWeight.logged_on !== lastWeight.logged_on
      ? lastWeight.value - firstWeight.value
      : null
    const workedWeight = monthCompletedExercises.reduce(
      (sum, exercise) => sum + (getWorkedWeight(exercise) ?? 0),
      0,
    )

    return {
      calories,
      foodDays: new Set(monthFoodLogs.map((food) => food.logged_on)).size,
      firstWeight,
      lastWeight,
      weightChange,
      weightMeasurements: monthWeightLogs.length,
      workedWeight,
      completedExercises: monthCompletedExercises.length,
    }
  })()
  const today = adminMode && testDate ? testDate : localISODate()

  const previousMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))
  }

  const selectCurrentMonthNutritionPeriod = () => {
    const currentDate = parseISODate(actualToday)
    const monthStart = localISODate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
    setNutritionPeriodPreset('current-month')
    setNutritionPeriodFrom(monthStart)
    setNutritionPeriodTo(actualToday)
    setNutritionCalendarSelection('start')
    setShowNutritionPeriod(false)
    setVisibleMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
  }

  const selectQuickNutritionPeriod = (days: QuickNutritionPeriodDays) => {
    const periodEnd = latestDate ?? actualToday
    const requestedStartDate = parseISODate(periodEnd)
    requestedStartDate.setDate(requestedStartDate.getDate() - days + 1)
    const requestedStart = localISODate(requestedStartDate)
    const periodStart = earliestDate && earliestDate > requestedStart
      ? earliestDate
      : requestedStart

    setNutritionPeriodPreset(days)
    setNutritionPeriodFrom(periodStart)
    setNutritionPeriodTo(periodEnd)
    setNutritionCalendarSelection('start')
    setShowNutritionPeriod(false)
    const endDate = parseISODate(periodEnd)
    setVisibleMonth(new Date(endDate.getFullYear(), endDate.getMonth(), 1))
  }

  const selectDay = (day: number) => {
    const date = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day)
    const selectedIsoDate = localISODate(date)

    if (showNutritionStatistics && showNutritionPeriod) {
      setNutritionPeriodPreset(null)
      if (nutritionCalendarSelection === 'start') {
        setNutritionPeriodFrom(selectedIsoDate)
        setNutritionPeriodTo(selectedIsoDate)
        setNutritionCalendarSelection('end')
      } else {
        if (selectedIsoDate < nutritionPeriodFrom) {
          setNutritionPeriodTo(nutritionPeriodFrom)
          setNutritionPeriodFrom(selectedIsoDate)
        } else {
          setNutritionPeriodTo(selectedIsoDate)
        }
        setNutritionCalendarSelection('start')
      }
      return
    }

    setSelectedDate(selectedIsoDate)
    setEditingFoodId(null)
    setFoodNameEditError(null)
    setAdminFoodFormOpen(false)
    setAdminFoodError(null)
  }

  const selectAdminSavedProduct = (productId: string) => {
    setAdminSavedProductId(productId)
    setAdminFoodError(null)
    const product = savedProducts.find((item) => item.id === productId)
    if (!product) return
    setAdminFoodName(product.name)
    setAdminFoodCalories(String(product.calories_per_100g))
    setAdminFoodProteins(String(product.proteins_per_100g))
    setAdminFoodFats(String(product.fats_per_100g))
    setAdminFoodCarbohydrates(String(product.carbohydrates_per_100g))
  }

  const resetAdminFoodForm = () => {
    setAdminSavedProductId('')
    setAdminFoodName('')
    setAdminFoodWeight('')
    setAdminFoodCalories('')
    setAdminFoodProteins('')
    setAdminFoodFats('')
    setAdminFoodCarbohydrates('')
    setAdminFoodError(null)
  }

  const addFoodToSelectedDate = async () => {
    if (!activeSelectedDate || activeSelectedDate >= actualToday || adminFoodBusy) return
    const values = [adminFoodWeight, adminFoodCalories, adminFoodProteins, adminFoodFats, adminFoodCarbohydrates]
      .map((value) => Number(value.replace(',', '.')))
    const [weight, calories, proteins, fats, carbohydrates] = values
    if (
      !adminFoodName.trim()
      || !Number.isFinite(weight) || weight <= 0
      || !Number.isFinite(calories) || calories < 0
      || !Number.isFinite(proteins) || proteins < 0
      || !Number.isFinite(fats) || fats < 0
      || !Number.isFinite(carbohydrates) || carbohydrates < 0
    ) {
      setAdminFoodError('Заполните название, вес и все значения КБЖУ')
      return
    }

    setAdminFoodBusy(true)
    setAdminFoodError(null)
    try {
      await logFoodOnDate(
        activeSelectedDate,
        adminFoodName.trim(),
        weight,
        calories,
        proteins,
        fats,
        carbohydrates,
      )
      resetAdminFoodForm()
      setAdminFoodFormOpen(false)
      setShowProducts(true)
    } catch (addError) {
      setAdminFoodError(addError instanceof Error ? addError.message : 'Не удалось добавить продукт')
    } finally {
      setAdminFoodBusy(false)
    }
  }

  const startEditingFoodName = (id: string, productName: string) => {
    setEditingFoodId(id)
    setEditingFoodName(productName)
    setFoodNameEditError(null)
  }

  const saveFoodName = async () => {
    const productName = editingFoodName.trim()
    if (!editingFoodId || !productName || foodNameEditBusy) {
      if (!productName) setFoodNameEditError('Введите название продукта')
      return
    }

    setFoodNameEditBusy(true)
    setFoodNameEditError(null)
    try {
      await updateFoodLogProductName(editingFoodId, productName)
      setEditingFoodId(null)
      setEditingFoodName('')
    } catch (editError) {
      setFoodNameEditError(editError instanceof Error ? editError.message : 'Не удалось изменить название продукта')
    } finally {
      setFoodNameEditBusy(false)
    }
  }

  const deleteFoodFromSelectedDate = async (id: string, productName: string) => {
    if (!adminMode || !activeSelectedDate || activeSelectedDate >= actualToday || deletingFoodId) return
    if (!window.confirm(`Удалить «${productName}» из продуктов за ${selectedLabel}?`)) return

    setDeletingFoodId(id)
    setDeleteFoodError(null)
    try {
      await deleteFoodLog(id)
      if (editingFoodId === id) {
        setEditingFoodId(null)
        setEditingFoodName('')
      }
    } catch (deleteError) {
      setDeleteFoodError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить продукт')
    } finally {
      setDeletingFoodId(null)
    }
  }

  const saveStatisticsSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (statisticsSettingsBusy) return

    const parsedTargets: Record<StatisticsNumericTargetKey, number | undefined> = {
      carbohydrates: parseTargetNumber(statisticsTargetForm.carbohydrates),
      weight7Days: parseWeightTarget(statisticsTargetForm.weight7Days),
      weight14Days: parseWeightTarget(statisticsTargetForm.weight14Days),
      weight28Days: parseWeightTarget(statisticsTargetForm.weight28Days),
    }
    if (Object.values(parsedTargets).some((value) => value !== undefined && !Number.isFinite(value))) {
      setStatisticsSettingsError('Введите корректные числовые значения')
      return
    }
    if (parsedTargets.carbohydrates !== undefined && parsedTargets.carbohydrates < 0) {
      setStatisticsSettingsError('Цель углеводов не может быть отрицательной')
      return
    }

    const nextMacroCalculatorSettings = {
      fatCaloriesPercent: parseTargetNumber(macroCalculatorSettingsForm.fatCaloriesPercent),
      proteinWeightMultiplier: parseTargetNumber(macroCalculatorSettingsForm.proteinWeightMultiplier),
    }
    if (
      nextMacroCalculatorSettings.fatCaloriesPercent === undefined
      || !Number.isFinite(nextMacroCalculatorSettings.fatCaloriesPercent)
      || nextMacroCalculatorSettings.fatCaloriesPercent < 0
      || nextMacroCalculatorSettings.fatCaloriesPercent > 100
    ) {
      setStatisticsSettingsError('Процент калорий для жиров должен быть от 0 до 100')
      return
    }
    if (
      nextMacroCalculatorSettings.proteinWeightMultiplier === undefined
      || !Number.isFinite(nextMacroCalculatorSettings.proteinWeightMultiplier)
      || nextMacroCalculatorSettings.proteinWeightMultiplier < 0
    ) {
      setStatisticsSettingsError('Множитель белков должен быть неотрицательным числом')
      return
    }

    const targets = {
      ...Object.fromEntries(
        Object.entries(parsedTargets).filter((entry): entry is [string, number] => entry[1] !== undefined),
      ),
      calculateMacroCalories: statisticsTargetForm.calculateMacroCalories,
      fatCaloriesPercent: nextMacroCalculatorSettings.fatCaloriesPercent,
      proteinWeightMultiplier: nextMacroCalculatorSettings.proteinWeightMultiplier,
    } as DiaryStatisticsTargets

    setStatisticsSettingsBusy(true)
    setStatisticsSettingsError(null)
    try {
      await saveDiaryStatisticsTargets(targets)
      setMacroCalculatorSettings(nextMacroCalculatorSettings as MacroCalculatorSettings)
    } catch (settingsError) {
      setStatisticsSettingsError(
        settingsError instanceof Error
          ? settingsError.message
          : 'Не удалось сохранить настройки статистики',
      )
    } finally {
      setStatisticsSettingsBusy(false)
    }
  }

  const updateStatisticsTarget = (key: StatisticsNumericTargetKey, value: string) => {
    setStatisticsTargetForm((current) => ({ ...current, [key]: value }))
    setStatisticsSettingsError(null)
  }

  const selectedLabel = activeSelectedDate
    ? parseISODate(activeSelectedDate).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Выберите день'

  return (
    <section className="diary-view">
      {adminMode && (
        <div className="withdrawal-test-date diary-test-date">
          <label htmlFor="diary-test-date-time">Тестовая дата и время</label>
          <input
            id="diary-test-date-time"
            type="datetime-local"
            value={testDateTime}
            onChange={(event) => {
              const nextValue = event.target.value
              setTestDateTime(nextValue)
              setTestTimeRunning(false)
              saveAdminTestDateTime(nextValue)
              if (nextValue) {
                const nextDate = parseISODate(nextValue.slice(0, 10))
                setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
                setSelectedDate(nextValue.slice(0, 10))
              }
            }}
          />
          <button
            type="button"
            className={`ghost compact diary-test-time-toggle${testTimeRunning ? ' active' : ''}`}
            onClick={() => {
              if (testTimeRunning) {
                const frozenTime = getAdminTestTime(profile?.time_zone)
                const frozenValue = frozenTime
                  ? dateTimeInputInTimeZone(frozenTime, profile?.time_zone)
                  : testDateTime
                setTestDateTime(frozenValue)
                saveAdminTestDateTime(frozenValue)
                setTestTimeRunning(false)
                if (frozenValue) {
                  const frozenDate = parseISODate(frozenValue.slice(0, 10))
                  setVisibleMonth(new Date(frozenDate.getFullYear(), frozenDate.getMonth(), 1))
                  setSelectedDate(frozenValue.slice(0, 10))
                }
                return
              }
              startAdminTestTime(testDateTime)
              setTestTimeRunning(true)
            }}
            disabled={!testDateTime}
            aria-pressed={testTimeRunning}
          >
            время on
          </button>
          <span className="hint">Локально симулирует дату и время без сохранения в БД.</span>
        </div>
      )}
      <div className="diary-calendar-column">
        <div className="diary-calendar">
          <div className="calendar-head">
            <button type="button" className="calendar-nav" onClick={previousMonth} aria-label="Предыдущий месяц">
              ←
            </button>
            <div className="calendar-title">
              <h2>
                {MONTHS[activeMonth.getMonth()]} {activeMonth.getFullYear()}
              </h2>
              <button
                type="button"
                className="info-button calendar-month-info-button"
                aria-label={`Сводка за ${MONTHS[activeMonth.getMonth()].toLocaleLowerCase('ru-RU')} ${activeMonth.getFullYear()}`}
                aria-expanded={showMonthSummary}
                aria-controls="diary-month-summary"
                onClick={() => setShowMonthSummary((open) => !open)}
              >
                i
              </button>
            </div>
            <button type="button" className="calendar-nav" onClick={nextMonth} aria-label="Следующий месяц">
              →
            </button>
          </div>
          <div className="calendar-grid" role="grid" aria-label="Календарь дневника">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="calendar-weekday">
                {weekday}
              </span>
            ))}
            {emptyDays.map((_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {monthDays.map((day) => {
              const iso = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day))
              const isFriday = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day).getDay() === 5
              const sunsetTime = profile && isFriday && profile.time_zone && profile.city_latitude !== null && profile.city_longitude !== null
                ? getSunsetTime(iso, profile.city_latitude, profile.city_longitude, profile.time_zone)
                : null
              const classes = [
                'calendar-day',
                datesWithRecords.has(iso) ? 'has-food' : '',
                datesWithMissedTasks.has(iso) ? 'has-missed-task' : '',
                datesWithTraining.has(iso) ? 'has-training' : '',
                activeSelectedDate === iso ? 'selected' : '',
                today === iso ? 'today' : '',
                showNutritionStatistics && showNutritionPeriod && iso >= nutritionPeriodFrom && iso <= nutritionPeriodTo
                  ? 'nutrition-period-range'
                  : '',
                showNutritionStatistics && showNutritionPeriod && iso === nutritionPeriodFrom
                  ? 'nutrition-period-start'
                  : '',
                showNutritionStatistics && showNutritionPeriod && iso === nutritionPeriodTo
                  ? 'nutrition-period-end'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <button key={iso} type="button" className={classes} onClick={() => selectDay(day)} aria-label={sunsetTime ? `${day}, заход солнца ${sunsetTime}` : undefined}>
                  <span>{day}</span>
                  {sunsetTime && <small className="calendar-sunset">{sunsetTime}</small>}
                </button>
              )
            })}
          </div>
        </div>


      </div>

      <div className="food-list diary-food-list">
        <div className="diary-list-head">
          <div>
            <h2>{selectedLabel}</h2>
            <p>
              {selectedWeight && (
                <span className="diary-summary-value">Вес: {formatWeight(selectedWeight.value)} кг</span>
              )}
            </p>
          </div>
        </div>
        <div className="diary-data-sections">
          <section className="diary-data-section" aria-labelledby="diary-products-heading">
            <div className="diary-section-head">
              <div>
                <h3 id="diary-products-heading">Питание</h3>
                <p>{selectedLogs.length ? `Всего: ${totalCalories.toFixed(0)} ккал` : 'Продукты не добавлялись'}</p>
              </div>
              <div className="diary-section-actions">
                {adminMode && activeSelectedDate && activeSelectedDate < actualToday && (
                  <button
                    type="button"
                    className="primary compact"
                    onClick={() => {
                      setAdminFoodFormOpen((open) => !open)
                      setAdminFoodError(null)
                    }}
                    aria-expanded={adminFoodFormOpen}
                  >
                    Добавить продукт
                  </button>
                )}
                <button
                  type="button"
                  className="primary compact"
                  onClick={() => {
                    if (!showNutritionStatistics) selectCurrentMonthNutritionPeriod()
                    setShowNutritionStatistics((open) => !open)
                  }}
                  aria-expanded={showNutritionStatistics}
                >
                  Статистика КБЖУ/вес
                </button>
                {selectedLogs.length > 0 && (
                  <button
                    type="button"
                    className="primary compact"
                    onClick={() => setShowProducts(!showProducts)}
                    aria-expanded={showProducts}
                  >
                    {showProducts ? 'Скрыть продукты' : 'Потреблённые продукты'}
                  </button>
                )}
              </div>
            </div>
            {adminMode && adminFoodFormOpen && activeSelectedDate && activeSelectedDate < actualToday && (
              <form
                className="diary-admin-food-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void addFoodToSelectedDate()
                }}
              >
                <label className="diary-admin-food-saved">
                  Сохранённый продукт
                  <select value={adminSavedProductId} onChange={(event) => selectAdminSavedProduct(event.target.value)} disabled={adminFoodBusy}>
                    <option value="">Ввести вручную</option>
                    {[...savedProducts]
                      .sort((a, b) => a.name.localeCompare(b.name, 'ru-RU'))
                      .map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                </label>
                <label>
                  Название
                  <input value={adminFoodName} onChange={(event) => setAdminFoodName(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Вес, г
                  <input type="number" min="0.1" step="0.1" inputMode="decimal" value={adminFoodWeight} onChange={(event) => setAdminFoodWeight(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Ккал / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodCalories} onChange={(event) => setAdminFoodCalories(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Белки / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodProteins} onChange={(event) => setAdminFoodProteins(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Жиры / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodFats} onChange={(event) => setAdminFoodFats(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <label>
                  Углеводы / 100 г
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={adminFoodCarbohydrates} onChange={(event) => setAdminFoodCarbohydrates(event.target.value)} disabled={adminFoodBusy} />
                </label>
                <div className="diary-admin-food-actions">
                  <button type="submit" className="primary compact" disabled={adminFoodBusy}>Сохранить</button>
                  <button
                    type="button"
                    className="ghost compact"
                    disabled={adminFoodBusy}
                    onClick={() => {
                      resetAdminFoodForm()
                      setAdminFoodFormOpen(false)
                    }}
                  >
                    Отмена
                  </button>
                </div>
                {adminFoodError && <p className="diary-food-name-error">{adminFoodError}</p>}
              </form>
            )}
            {showProducts && (
              <>
                <p className="diary-nutrition-total">
                  Итого за день: <strong>Б {totalNutrition.proteins.toFixed(1)} г</strong>
                  <strong>Ж {totalNutrition.fats.toFixed(1)} г</strong>
                  <strong>У {totalNutrition.carbohydrates.toFixed(1)} г</strong>
                </p>
                <ul>
                  {selectedLogs.map((food) => {
                    const consumed = (food.weight_grams / 100) * food.calories_per_100g
                    const nutritionMultiplier = food.weight_grams / 100
                    return (
                      <li key={food.id} className="food-item">
                        <div className="food-details">
                          {adminMode && editingFoodId === food.id ? (
                            <form
                              className="diary-food-name-editor"
                              onSubmit={(event) => {
                                event.preventDefault()
                                void saveFoodName()
                              }}
                            >
                              <input
                                value={editingFoodName}
                                onChange={(event) => setEditingFoodName(event.target.value)}
                                aria-label="Название потреблённого продукта"
                                autoFocus
                              />
                              <button type="submit" className="primary compact" disabled={foodNameEditBusy}>Сохранить</button>
                              <button
                                type="button"
                                className="ghost compact"
                                disabled={foodNameEditBusy}
                                onClick={() => {
                                  setEditingFoodId(null)
                                  setFoodNameEditError(null)
                                }}
                              >
                                Отмена
                              </button>
                            </form>
                          ) : (
                            <div className="diary-food-name-row">
                              <div className="food-name">{food.product_name}</div>
                              {adminMode && (
                                <button
                                  type="button"
                                  className="diary-food-edit-button"
                                  onClick={() => startEditingFoodName(food.id, food.product_name)}
                                  aria-label={`Изменить название продукта «${food.product_name}»`}
                                  title="Изменить название"
                                >
                                  ✎
                                </button>
                              )}
                            </div>
                          )}
                          {adminMode && editingFoodId === food.id && foodNameEditError && (
                            <p className="diary-food-name-error">{foodNameEditError}</p>
                          )}
                          <div className="food-info">
                            <span>{food.weight_grams}г</span>
                            <span>•</span>
                            <span>{food.calories_per_100g} ккал/100г</span>
                            <span>•</span>
                            <span className="consumed">{consumed.toFixed(0)} ккал</span>
                            <span>•</span>
                            <span>Б {(nutritionMultiplier * food.proteins_per_100g).toFixed(1)} г</span>
                            <span>•</span>
                            <span>Ж {(nutritionMultiplier * food.fats_per_100g).toFixed(1)} г</span>
                            <span>•</span>
                            <span>У {(nutritionMultiplier * food.carbohydrates_per_100g).toFixed(1)} г</span>
                          </div>
                        </div>
                        {adminMode && activeSelectedDate && activeSelectedDate < actualToday && (
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => void deleteFoodFromSelectedDate(food.id, food.product_name)}
                            disabled={deletingFoodId !== null}
                            aria-label={`Удалить продукт «${food.product_name}»`}
                            title="Удалить"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {deleteFoodError && <p className="diary-food-name-error">{deleteFoodError}</p>}
              </>
            )}
          </section>

          {showNutritionStatistics && (
            <div className="diary-nutrition-statistics-layout">
              <section className="diary-nutrition-statistics" aria-labelledby="diary-nutrition-statistics-heading">
              <div className="diary-nutrition-statistics-head">
                <div>
                  <h3 id="diary-nutrition-statistics-heading">Статистика за период</h3>
                  <p>
                    Средние значения за сутки · {formatPeriodDate(nutritionPeriodFrom)} — {formatPeriodDate(nutritionPeriodTo)}
                  </p>
                </div>
                <div className="diary-nutrition-statistics-actions">
                  <button
                    type="button"
                    className="primary compact diary-period-details-button"
                    onClick={() => setShowNutritionPeriodDetails(true)}
                    aria-haspopup="dialog"
                  >
                    Детали
                  </button>
                  <select
                    className="diary-nutrition-quick-period"
                    value={nutritionPeriodPreset ?? ''}
                    onChange={(event) => {
                      if (event.target.value === 'current-month') {
                        selectCurrentMonthNutritionPeriod()
                        return
                      }
                      const days = Number(event.target.value)
                      if (QUICK_NUTRITION_PERIOD_DAYS.includes(days as QuickNutritionPeriodDays)) {
                        selectQuickNutritionPeriod(days as QuickNutritionPeriodDays)
                      }
                    }}
                    aria-label="Быстрый выбор периода статистики"
                  >
                    <option value="">Период</option>
                    <option value="current-month">Текущий месяц</option>
                    {QUICK_NUTRITION_PERIOD_DAYS.map((days) => (
                      <option key={days} value={days}>{formatDaysCount(days)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="primary compact diary-period-picker-button"
                    onClick={() => {
                      setShowNutritionPeriod((open) => {
                        if (!open) setNutritionCalendarSelection('start')
                        return !open
                      })
                    }}
                    aria-expanded={showNutritionPeriod}
                    aria-controls="diary-nutrition-period"
                  >
                    Выбрать период
                  </button>
                  <button
                    type="button"
                    className={`primary diary-statistics-settings-button${showStatisticsSettings ? ' active' : ''}`}
                    onClick={() => {
                      setShowStatisticsSettings((open) => {
                        if (!open) {
                          setStatisticsTargetForm(statisticsTargetsToForm(profile?.diary_statistics_targets))
                          setMacroCalculatorSettingsForm(macroCalculatorSettingsToForm(
                            macroCalculatorSettingsFromTargets(profile?.diary_statistics_targets),
                          ))
                          setStatisticsSettingsError(null)
                        }
                        return !open
                      })
                    }}
                    aria-expanded={showStatisticsSettings}
                    aria-controls="diary-statistics-settings"
                    aria-label="Настройка целей статистики"
                    title="Настройка"
                  >
                    <span aria-hidden="true">⚙</span>
                  </button>
                </div>
              </div>
              {showStatisticsSettings && (
                <form id="diary-statistics-settings" className="diary-statistics-settings" onSubmit={saveStatisticsSettings}>
                  <fieldset>
                    <legend>Цель БЖУ за сутки</legend>
                    <p>По умолчанию: жиры — 30% нормы калорий, белки — желаемый вес × 1,4.</p>
                    <div className="diary-statistics-settings-grid diary-statistics-nutrition-targets">
                      <label>
                        Грамм белка на кг тела от желаемой цели
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          inputMode="decimal"
                          value={macroCalculatorSettingsForm.proteinWeightMultiplier}
                          onChange={(event) => {
                            setMacroCalculatorSettingsForm((current) => ({
                              ...current,
                              proteinWeightMultiplier: event.target.value,
                            }))
                            setStatisticsSettingsError(null)
                          }}
                          disabled={statisticsSettingsBusy}
                        />
                      </label>
                      <label>
                        Жиры, % от нормы калорий
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          inputMode="decimal"
                          value={macroCalculatorSettingsForm.fatCaloriesPercent}
                          onChange={(event) => {
                            setMacroCalculatorSettingsForm((current) => ({
                              ...current,
                              fatCaloriesPercent: event.target.value,
                            }))
                            setStatisticsSettingsError(null)
                          }}
                          disabled={statisticsSettingsBusy}
                        />
                      </label>
                      <label>
                        Углеводы, г
                        <input
                          className="diary-statistics-carbohydrate-input"
                          type="number"
                          min="0"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="Норма калорий -жиры и -белки (по дефолту)"
                          title={'По умолчанию расчет происходит: "норма калорий" минус цель по белкам и жирам'}
                          value={statisticsTargetForm.carbohydrates}
                          onChange={(event) => updateStatisticsTarget('carbohydrates', event.target.value)}
                          disabled={statisticsSettingsBusy}
                        />
                      </label>
                    </div>
                    <label className="diary-statistics-flag">
                      <input
                        type="checkbox"
                        checked={statisticsTargetForm.calculateMacroCalories}
                        onChange={(event) => {
                          setStatisticsTargetForm((current) => ({
                            ...current,
                            calculateMacroCalories: event.target.checked,
                          }))
                          setStatisticsSettingsError(null)
                        }}
                        disabled={statisticsSettingsBusy}
                      />
                      <span>Расчет калорий для Б/Ж/У</span>
                    </label>
                  </fieldset>
                  <fieldset>
                    <legend>
                      Цель коррекции веса за период
                      <button
                        type="button"
                        className="diary-statistics-info-button"
                        onClick={() => setShowWeightTargetInfo((open) => !open)}
                        aria-expanded={showWeightTargetInfo}
                        aria-controls="diary-weight-target-info"
                        aria-label="Как вводить желаемое изменение веса"
                        title="Как вводить значения"
                      >
                        i
                      </button>
                    </legend>
                    {showWeightTargetInfo && (
                      <p id="diary-weight-target-info" className="diary-statistics-weight-info">
                        Значение без знака считается снижением: 1 сохраняется как −1 кг.
                        Для увеличения веса поставьте плюс: +1 сохраняется как +1 кг.
                      </p>
                    )}
                    <div className="diary-statistics-settings-grid">
                      <label>
                        За 7 суток, кг
                        <input type="text" inputMode="text" pattern="[+\-]?[0-9]*[.,]?[0-9]*" placeholder="Например, 1 или +1" value={statisticsTargetForm.weight7Days} onChange={(event) => updateStatisticsTarget('weight7Days', event.target.value)} disabled={statisticsSettingsBusy} />
                      </label>
                      <label>
                        За 14 суток, кг
                        <input type="text" inputMode="text" pattern="[+\-]?[0-9]*[.,]?[0-9]*" placeholder="Например, 2 или +2" value={statisticsTargetForm.weight14Days} onChange={(event) => updateStatisticsTarget('weight14Days', event.target.value)} disabled={statisticsSettingsBusy} />
                      </label>
                      <label>
                        За 28 суток, кг
                        <input type="text" inputMode="text" pattern="[+\-]?[0-9]*[.,]?[0-9]*" placeholder="Например, 4 или +4" value={statisticsTargetForm.weight28Days} onChange={(event) => updateStatisticsTarget('weight28Days', event.target.value)} disabled={statisticsSettingsBusy} />
                      </label>
                    </div>
                    <p>Ноль отключает сравнение для выбранного периода.</p>
                  </fieldset>
                  <div className="diary-statistics-settings-actions">
                    <button type="submit" className="primary compact" disabled={statisticsSettingsBusy}>Сохранить</button>
                    <button
                      type="button"
                      className="primary compact"
                      disabled={statisticsSettingsBusy}
                      onClick={() => {
                        setStatisticsTargetForm(statisticsTargetsToForm(profile?.diary_statistics_targets))
                        setMacroCalculatorSettingsForm(macroCalculatorSettingsToForm(macroCalculatorSettings))
                        setStatisticsSettingsError(null)
                        setShowStatisticsSettings(false)
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                  {statisticsSettingsError && <p className="diary-statistics-settings-error">{statisticsSettingsError}</p>}
                </form>
              )}
              {showNutritionPeriod && (
                <div id="diary-nutrition-period" className="diary-nutrition-period">
                  <p className="diary-nutrition-period-hint">
                    {nutritionCalendarSelection === 'start'
                      ? 'Выберите начальную дату в календаре'
                      : 'Теперь выберите конечную дату'}
                  </p>
                  <label>
                    Начальная дата
                    <input
                      type="date"
                      value={nutritionPeriodFrom}
                      max={actualToday}
                      onChange={(event) => {
                        setNutritionPeriodPreset(null)
                        setNutritionPeriodFrom(event.target.value)
                        setNutritionCalendarSelection('start')
                      }}
                    />
                  </label>
                  <label>
                    Конечная дата
                    <input
                      type="date"
                      value={nutritionPeriodTo}
                      max={actualToday}
                      onChange={(event) => {
                        setNutritionPeriodPreset(null)
                        setNutritionPeriodTo(event.target.value)
                        setNutritionCalendarSelection('start')
                      }}
                    />
                  </label>
                </div>
              )}
              {!nutritionPeriodStatistics ? (
                <p className="diary-nutrition-statistics-empty">Конечная дата должна быть не раньше начальной.</p>
              ) : nutritionPeriodStatistics.trackedDays === 0 ? (
                <p className="diary-nutrition-statistics-empty">За выбранный период записей о питании нет.</p>
              ) : (
                <>
                  <div className="diary-nutrition-statistics-grid">
                    {[
                      { label: 'Калории', actual: nutritionPeriodStatistics.calories, target: effectiveDailyCaloriesNorm ?? undefined, unit: 'ккал', digits: 0, calorieMultiplier: undefined, productFilter: undefined },
                      { label: 'Белки', actual: nutritionPeriodStatistics.proteins, target: calculatedProteinTarget, unit: 'г', digits: 1, calorieMultiplier: 4, productFilter: 'proteins' as const },
                      { label: 'Жиры', actual: nutritionPeriodStatistics.fats, target: calculatedFatTarget, unit: 'г', digits: 1, calorieMultiplier: 9, productFilter: 'fats' as const },
                      { label: 'Углеводы', actual: nutritionPeriodStatistics.carbohydrates, target: calculatedCarbohydrateTarget, unit: 'г', digits: 1, calorieMultiplier: 4, productFilter: 'carbohydrates' as const },
                    ].map((item) => (
                      <div key={item.label}>
                        <StatisticValueComparison
                          label={item.label}
                          actual={item.actual}
                          actualText={`${formatStatisticValue(item.actual, item.digits)} ${item.unit}`}
                          target={item.target}
                          targetText={hasTarget(item.target)
                            ? `${formatStatisticValue(item.target, item.digits)} ${item.unit}`
                            : undefined}
                          targetColor={hasTarget(item.target)
                            ? getDeviationColor(item.actual, item.target)
                            : undefined}
                          actualSecondaryText={statisticsTargets.calculateMacroCalories && item.calorieMultiplier
                            ? `${formatStatisticValue(item.actual * item.calorieMultiplier, 1)} ккал`
                            : undefined}
                          targetSecondaryText={statisticsTargets.calculateMacroCalories && item.calorieMultiplier && hasTarget(item.target)
                            ? `${formatStatisticValue(item.target * item.calorieMultiplier, 1)} ккал`
                            : undefined}
                          labelExpanded={item.productFilter
                            ? activeMacroProductFilter === item.productFilter
                            : undefined}
                          onLabelClick={item.productFilter
                            ? () => toggleMacroProductFilter(item.productFilter)
                            : undefined}
                        />
                        {item.productFilter && activeMacroProductFilter === item.productFilter && (
                          <div className="diary-macro-products-popover">
                            <div className="diary-macro-products-popover-head">
                              <strong>На 100 г</strong>
                              {item.productFilter === 'proteins' ? (
                                <button
                                  type="button"
                                  className={proteinBalanceSort ? 'active' : undefined}
                                  disabled={!proteinBalanceAvailable}
                                  onClick={() => setProteinBalanceSort((active) => !active)}
                                  aria-pressed={proteinBalanceSort}
                                  title={proteinBalanceAvailable
                                    ? 'Сортировать по соотношению белков и жиров из калькулятора КБЖУ'
                                    : 'Введите белки и жиры в калькуляторе КБЖУ'}
                                >
                                  Калькулятор КБЖУ
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setMacroProductSortDirection((current) => current === 'desc' ? 'asc' : 'desc')}
                                  aria-label={macroProductSortDirection === 'desc'
                                    ? 'Сортировать от меньшего к большему'
                                    : 'Сортировать от большего к меньшему'}
                                  title="Изменить порядок сортировки"
                                >
                                  {macroProductSortDirection === 'desc' ? 'По убыванию ↓' : 'По возрастанию ↑'}
                                </button>
                              )}
                            </div>
                            {filteredSavedProducts.length === 0 ? (
                              <p>Сохранённых продуктов нет</p>
                            ) : (
                              <ul>
                                {filteredSavedProducts.map((product) => (
                                  <li key={product.id}>
                                    <span>{product.name}</span>
                                    {item.productFilter === 'proteins' ? (
                                      <b className="diary-macro-products-values">
                                        Б {formatStatisticValue(product.proteins_per_100g, 1)} г · Ж {formatStatisticValue(product.fats_per_100g, 1)} г
                                      </b>
                                    ) : (
                                      <b>{formatStatisticValue(getSavedProductMacro(product, item.productFilter), 1)} г</b>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="diary-nutrition-statistics-days">
                    Учтено дней с питанием: {nutritionPeriodStatistics.trackedDays}
                  </p>
                </>
              )}
              <div className="diary-weight-change-statistic">
                <span>Среднее изменение веса</span>
                {weightPeriodStatistics ? (
                  <>
                    <div className="diary-weight-change-values">
                      {[7, 14, 28]
                        .filter((days) => days === 28 || weightPeriodStatistics.selectedDays >= days)
                      .map((days) => {
                        const change = weightPeriodStatistics.averageDailyChange * days
                        const target = statisticsTargets[weightTargetKey(days)]
                        return (
                          <div key={days}>
                            <StatisticValueComparison
                              label={days === 1 ? 'За сутки' : `За ${formatDaysCount(days)}`}
                              actual={change}
                              actualText={`${formatSignedWeight(change)} кг`}
                              target={target}
                              targetText={hasTarget(target) ? `${formatSignedWeight(target)} кг` : undefined}
                              targetColor={hasTarget(target) ? getTargetDeviationColor(change, target) : undefined}
                            />
                          </div>
                          )
                        })}
                    </div>
                    <small>
                      {formatPeriodDate(weightPeriodStatistics.firstDate)} — {formatPeriodDate(weightPeriodStatistics.lastDate)}
                      {' · '}{formatMeasurementCount(weightPeriodStatistics.measurements)}
                    </small>
                    <small>Расчёт по среднему</small>
                  </>
                ) : (
                  <>
                    <strong>Недостаточно данных</strong>
                    <small>Нужно минимум два замера веса в разные дни</small>
                  </>
                )}
              </div>
              </section>
              <MacroNutrientCalculator
                key={`${profile?.id ?? 'no-user'}-${effectiveDailyCaloriesNorm ?? 'no-calorie-norm'}-${profile?.desired_weight ?? 'no-desired-weight'}-${macroCalculatorSettings.fatCaloriesPercent}-${macroCalculatorSettings.proteinWeightMultiplier}`}
                dailyCaloriesNorm={effectiveDailyCaloriesNorm}
                desiredWeight={profile?.desired_weight}
                settings={macroCalculatorSettings}
                savedProducts={savedProducts}
                userId={profile?.id ?? null}
                onBalanceValuesChange={setMacroCalculatorBalanceValues}
                onTargetValuesChange={setMacroCalculatorTargetValues}
              />
            </div>
          )}

          <section className="diary-data-section diary-exercises" aria-labelledby="diary-exercises-heading">
            <div className="diary-section-head">
              <div>
                <h3 id="diary-exercises-heading">Тренировка</h3>
                <p>
                  {completedExercises.length
                    ? `Выполнено упражнений: ${completedExercises.length}`
                    : plannedExercises.length
                      ? 'Завершённых упражнений нет'
                      : 'Не запланировано'}
                </p>
              </div>
              <div className="diary-section-actions">
                {plannedExercises.length > 0 && (
                  <button
                    type="button"
                    className="primary compact"
                    onClick={() => setShowExercises(!showExercises)}
                    aria-expanded={showExercises}
                  >
                    {showExercises ? 'Скрыть упражнения' : 'Выполненные упражнения'}
                  </button>
                )}
                <button
                  type="button"
                  className="primary compact"
                  onClick={() => setShowTrainingStatistics((open) => !open)}
                  aria-expanded={showTrainingStatistics}
                >
                  Статистика
                </button>
              </div>
            </div>
            {showExercises && (
              <>
                <p className="worked-weight">
                  Всего поднято доп. веса: <strong>{formatWeight(totalWorkedWeight)} кг</strong>
                </p>
                {completedExercises.length === 0 ? (
                  <p className="empty">В этот день нет завершённых упражнений.</p>
                ) : (
                  <ul>
                    {completedExercises.map((exercise) => (
                      <li key={exercise.id} className="food-item">
                        <div className="food-details">
                          <div className="food-name">{exercise.exercise_name}</div>
                          <div className="food-info">
                            {exercise.weight_kg !== null && <span>Вес снаряда: {formatWeight(exercise.weight_kg)} кг</span>}
                            {exercise.weight_kg !== null && <span>•</span>}
                            <span>Повторения: {exercise.repetitions ?? '—'}</span>
                            <span>•</span>
                            <span>Подходы: {exercise.sets ?? '—'}</span>
                            {getWorkedWeight(exercise) !== null && (
                              <>
                                <span>•</span>
                                <span>Отработанный вес: {formatWeight(getWorkedWeight(exercise)!)} кг</span>
                              </>
                            )}
                            {exercise.rest_timer_enabled && (
                              <>
                                <span>•</span>
                                <span>Время между подходами: {exercise.rest_duration ?? '00:00'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {showTrainingStatistics && (
              <ExerciseStatistics
                exercises={scheduledExercises}
                from={statisticsMonthStart}
                to={statisticsMonthEnd}
                periodLabel={`${MONTHS[activeMonth.getMonth()].toLocaleLowerCase('ru-RU')} ${activeMonth.getFullYear()}`}
              />
            )}
          </section>
        </div>
      </div>
      {showMonthSummary && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowMonthSummary(false)}>
          <section
            id="diary-month-summary"
            className="modal-content diary-month-summary-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diary-month-summary-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="diary-month-summary-head">
              <div>
                <h3 id="diary-month-summary-title">Итоги месяца</h3>
                <div className="diary-month-summary-period">
                  <button
                    type="button"
                    className="calendar-nav"
                    onClick={previousMonth}
                    aria-label="Показать итоги предыдущего месяца"
                  >
                    ←
                  </button>
                  <span aria-live="polite">
                    {MONTHS[activeMonth.getMonth()]} {activeMonth.getFullYear()}
                  </span>
                  <button
                    type="button"
                    className="calendar-nav"
                    onClick={nextMonth}
                    aria-label="Показать итоги следующего месяца"
                  >
                    →
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="icon-close"
                aria-label="Закрыть сводку за месяц"
                onClick={() => setShowMonthSummary(false)}
                autoFocus
              >
                ×
              </button>
            </header>
            <div className="exercise-statistics-table-wrap">
              <table className="exercise-statistics-table diary-month-summary-table">
                <thead>
                  <tr>
                    <th>Показатель</th>
                    <th>Значение</th>
                    <th>Данные</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Потреблено калорий</th>
                    <td>{Math.round(monthSummary.calories).toLocaleString('ru-RU')} ккал</td>
                    <td>{formatTrackedDays(monthSummary.foodDays)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Изменение веса</th>
                    <td>{monthSummary.weightChange === null ? 'Недостаточно данных' : formatMonthWeightChange(monthSummary.weightChange)}</td>
                    <td>
                      {monthSummary.firstWeight && monthSummary.lastWeight
                        ? `${formatWeight(monthSummary.firstWeight.value)} → ${formatWeight(monthSummary.lastWeight.value)} кг · ${formatMeasurements(monthSummary.weightMeasurements)}`
                        : 'Нет замеров'}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Вес выполненных тренировок</th>
                    <td>{formatWeight(monthSummary.workedWeight)} кг</td>
                    <td>{formatCompletedExercises(monthSummary.completedExercises)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {showNutritionPeriodDetails && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowNutritionPeriodDetails(false)}>
          <section
            className="modal-content diary-period-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diary-period-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="diary-period-details-head">
              <div>
                <h3 id="diary-period-details-title">Детали за период</h3>
                <p>{formatPeriodDate(nutritionPeriodFrom)} — {formatPeriodDate(nutritionPeriodTo)}</p>
              </div>
              <button
                type="button"
                className="icon-close"
                aria-label="Закрыть детали за период"
                onClick={() => setShowNutritionPeriodDetails(false)}
                autoFocus
              >
                ×
              </button>
            </header>
            {nutritionPeriodDetails.length === 0 ? (
              <p className="diary-nutrition-statistics-empty">За выбранный период записей нет.</p>
            ) : (
              <div className="exercise-statistics-table-wrap diary-period-details-table-wrap">
                <table className="exercise-statistics-table diary-period-details-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Вес</th>
                      <th>Калории за сутки</th>
                      <th>Белки</th>
                      <th>Жиры</th>
                      <th>Углеводы</th>
                    </tr>
                    <tr className="diary-period-details-average-row">
                      <th scope="row">Среднее</th>
                      <td>{formatPeriodWeightRange(
                        nutritionPeriodDetailAverages.firstWeight,
                        nutritionPeriodDetailAverages.lastWeight,
                        nutritionPeriodDetailAverages.weightDecreased,
                        sevenDayWeightTrendColor,
                        targetWeightAtPeriodEnd,
                      )}</td>
                      <td>{formatAverageWithTarget(nutritionPeriodDetailAverages.calories, macroCalculatorTargetValues.calories, 0, 'ккал')}</td>
                      <td>{formatAverageWithTarget(nutritionPeriodDetailAverages.proteins, macroCalculatorTargetValues.proteins, 1, 'г')}</td>
                      <td>{formatAverageWithTarget(nutritionPeriodDetailAverages.fats, macroCalculatorTargetValues.fats, 1, 'г')}</td>
                      <td>{formatAverageWithTarget(nutritionPeriodDetailAverages.carbohydrates, macroCalculatorTargetValues.carbohydrates, 1, 'г')}</td>
                    </tr>
                  </thead>
                  <tbody>
                    {nutritionPeriodDetails.map((row) => (
                      <tr key={row.date}>
                        <th scope="row">{formatPeriodDate(row.date)}</th>
                        <td>{row.weight === null ? '—' : formatWeight(row.weight)}</td>
                        <td>{row.hasNutrition ? `${Math.round(row.calories).toLocaleString('ru-RU')} ккал` : '—'}</td>
                        <td>{row.hasNutrition ? `${formatStatisticValue(row.proteins, 1)} г` : '—'}</td>
                        <td>{row.hasNutrition ? `${formatStatisticValue(row.fats, 1)} г` : '—'}</td>
                        <td>{row.hasNutrition ? `${formatStatisticValue(row.carbohydrates, 1)} г` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

function formatDaysCount(value: number) {
  const absoluteValue = Math.abs(value)
  const usesSingularForm = absoluteValue % 10 === 1 && absoluteValue % 100 !== 11
  return `${value} ${usesSingularForm ? 'сутки' : 'суток'}`
}

function formatWeight(value: number) {
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

function formatPeriodWeightRange(
  first: number | null,
  last: number | null,
  decreased: boolean,
  trendColor?: string,
  targetWeight?: number | null,
) {
  if (first === null || last === null) return '—'
  const unchanged = first === last
  return (
    <span
      className="diary-period-weight-range"
      aria-label={`Первый вес ${formatWeight(first)}, последний вес ${formatWeight(last)}`}
    >
      <span>{formatWeight(first)}</span>
      {unchanged ? (
        <span aria-hidden="true">=</span>
      ) : (
        <span
          className={`diary-period-weight-range-trend ${decreased ? 'down' : 'up'}`}
          style={trendColor
            ? decreased ? { borderTopColor: trendColor } : { borderBottomColor: trendColor }
            : undefined}
          aria-hidden="true"
        />
      )}
      <span>{formatWeight(last)}</span>
      {targetWeight !== null && targetWeight !== undefined && (
        <span
          className="diary-period-weight-target"
          title="Расчётный вес по цели изменения за 7 суток"
        >
          ({formatWeight(targetWeight)})
        </span>
      )}
    </span>
  )
}

function formatMonthWeightChange(value: number) {
  if (value === 0) return '0 кг'
  return `${value > 0 ? '+' : '−'}${formatWeight(Math.abs(value))} кг`
}

function formatTrackedDays(value: number) {
  const lastTwoDigits = value % 100
  const lastDigit = value % 10
  const word = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? 'дней с записями'
    : lastDigit === 1
      ? 'день с записями'
      : lastDigit >= 2 && lastDigit <= 4
        ? 'дня с записями'
        : 'дней с записями'
  return `${value} ${word}`
}

function formatMeasurements(value: number) {
  const lastTwoDigits = value % 100
  const lastDigit = value % 10
  const word = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? 'замеров'
    : lastDigit === 1
      ? 'замер'
      : lastDigit >= 2 && lastDigit <= 4
        ? 'замера'
        : 'замеров'
  return `${value} ${word}`
}

function formatCompletedExercises(value: number) {
  return `Выполнено упражнений: ${value}`
}

function formatPeriodDate(value: string) {
  if (!value) return 'дата не выбрана'
  return parseISODate(value).toLocaleDateString('ru-RU')
}

function statisticsTargetsToForm(targets: DiaryStatisticsTargets | null | undefined): StatisticsTargetForm {
  return {
    carbohydrates: targetInputValue(targets?.carbohydrates),
    calculateMacroCalories: targets?.calculateMacroCalories === true,
    weight7Days: weightTargetInputValue(targets?.weight7Days),
    weight14Days: weightTargetInputValue(targets?.weight14Days),
    weight28Days: weightTargetInputValue(targets?.weight28Days),
  }
}

function targetInputValue(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function weightTargetInputValue(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return value > 0 ? `+${value}` : String(value)
}

function parseTargetNumber(value: string) {
  const normalized = value.trim().replace(',', '.')
  return normalized === '' ? undefined : Number(normalized)
}

function parseWeightTarget(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (normalized === '') return undefined
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed === 0) return parsed
  return normalized.startsWith('+') ? Math.abs(parsed) : -Math.abs(parsed)
}

function macroCalculatorSettingsFromTargets(
  targets: DiaryStatisticsTargets | null | undefined,
): MacroCalculatorSettings {
  return {
    fatCaloriesPercent: typeof targets?.fatCaloriesPercent === 'number'
      && Number.isFinite(targets.fatCaloriesPercent)
      && targets.fatCaloriesPercent >= 0
      && targets.fatCaloriesPercent <= 100
      ? targets.fatCaloriesPercent
      : DEFAULT_MACRO_CALCULATOR_SETTINGS.fatCaloriesPercent,
    proteinWeightMultiplier: typeof targets?.proteinWeightMultiplier === 'number'
      && Number.isFinite(targets.proteinWeightMultiplier)
      && targets.proteinWeightMultiplier >= 0
      ? targets.proteinWeightMultiplier
      : DEFAULT_MACRO_CALCULATOR_SETTINGS.proteinWeightMultiplier,
  }
}

function macroCalculatorSettingsToForm(settings: MacroCalculatorSettings): MacroCalculatorSettingsForm {
  return {
    fatCaloriesPercent: String(settings.fatCaloriesPercent),
    proteinWeightMultiplier: String(settings.proteinWeightMultiplier),
  }
}

function hasTarget(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0
}

function weightTargetKey(days: number): 'weightDay' | 'weight7Days' | 'weight14Days' | 'weight28Days' {
  if (days === 7) return 'weight7Days'
  if (days === 14) return 'weight14Days'
  if (days === 28) return 'weight28Days'
  return 'weightDay'
}

function formatStatisticValue(value: number, maximumFractionDigits: number) {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  })
}

function formatAverageWithTarget(
  actual: number | null,
  target: number | null,
  fractionDigits: number,
  unit: string,
) {
  if (actual === null) return '—'
  const actualText = `${formatStatisticValue(actual, fractionDigits)} ${unit}`
  if (target === null) return actualText

  const difference = Number((actual - target).toFixed(fractionDigits))
  const differenceText = formatStatisticValue(Math.abs(difference), fractionDigits)
  const differenceLabel = difference > 0
    ? `выше цели на ${differenceText}`
    : difference < 0
      ? `ниже цели на ${differenceText}`
      : 'соответствует цели'
  return (
    <span
      className="diary-average-comparison"
      aria-label={`${actualText}, ${differenceLabel}`}
    >
      <span>{actualText}</span>
      <span className="diary-average-difference">
        {'('}
        {difference !== 0 && (
          <span
            className={`diary-average-trend ${difference < 0 ? 'down' : 'up'}`}
            style={difference < 0
              ? { borderTopColor: getAverageDeviationColor(actual, target) }
              : { borderBottomColor: getAverageDeviationColor(actual, target) }}
            aria-hidden="true"
          />
        )}
        {differenceText}
        {')'}
      </span>
    </span>
  )
}

function formatSignedWeight(value: number) {
  if (Math.abs(value) < 0.005) return '0,0'
  const formatted = Math.abs(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
  return `${value > 0 ? '+' : '−'}${formatted}`
}

function getTargetDeviationColor(actual: number, target: number) {
  if (isWeightTargetReached(actual, target)) return 'hsl(120 72% 44%)'

  return getDeviationColor(actual, target)
}

function getDeviationColor(actual: number, target: number) {
  const deviation = Math.abs(actual - target) / Math.abs(target)
  const colorProgress = Math.min(1, deviation / 0.5)
  const hue = Math.round(120 * (1 - colorProgress))
  return `hsl(${hue} 72% 44%)`
}

function getAverageDeviationColor(actual: number, target: number) {
  const deviation = Math.abs(actual - target) / Math.abs(target)
  const colorProgress = Math.min(1, Math.max(0, (deviation - 0.1) / 0.2))
  const hue = Math.round(120 * (1 - colorProgress))
  return `hsl(${hue} 72% 44%)`
}

function isWeightTargetReached(actual: number, target: number) {
  return target < 0 ? actual <= target : actual >= target
}

type MacroCalculatorKey = 'proteins' | 'fats' | 'carbohydrates'
type MacroCalculatorMode = 'calculator' | 'protein'

type MacroCalculatorProductEntry = {
  id: string
  productId: string
  name: string
  weightGrams: number
  caloriesPer100g: number
  proteinsPer100g: number
  fatsPer100g: number
  carbohydratesPer100g: number
}

type MacroCalculatorProductStorage = {
  version: 1
  userId: string
  entries: MacroCalculatorProductEntry[]
}

const MACRO_CALCULATOR_PRODUCTS_STORAGE_PREFIX = 'mlf:macro-calculator-products:v1:'

const MACRO_CALCULATOR_FIELDS: Array<{
  key: MacroCalculatorKey
  label: string
  calorieFactor: number
}> = [
  { key: 'proteins', label: 'Белки', calorieFactor: 4 },
  { key: 'fats', label: 'Жиры', calorieFactor: 9 },
  { key: 'carbohydrates', label: 'Углеводы', calorieFactor: 4 },
]

function MacroNutrientCalculator({
  dailyCaloriesNorm,
  desiredWeight,
  settings,
  savedProducts,
  userId,
  onBalanceValuesChange,
  onTargetValuesChange,
}: {
  dailyCaloriesNorm?: number | null
  desiredWeight?: number | null
  settings: MacroCalculatorSettings
  savedProducts: SavedProduct[]
  userId: string | null
  onBalanceValuesChange: (values: MacroCalculatorBalanceValues) => void
  onTargetValuesChange: (values: MacroCalculatorTargetValues) => void
}) {
  const [values, setValues] = useState<Record<MacroCalculatorKey, { grams: string; calories: string }>>(() => {
    const defaultFatCalories = typeof dailyCaloriesNorm === 'number' && dailyCaloriesNorm > 0
      ? dailyCaloriesNorm * (settings.fatCaloriesPercent / 100)
      : null
    const defaultProteinGrams = typeof desiredWeight === 'number' && desiredWeight > 0
      ? desiredWeight * settings.proteinWeightMultiplier
      : null
    const defaultProteinCalories = defaultProteinGrams === null ? null : defaultProteinGrams * 4
    const defaultCarbohydrateCalories = typeof dailyCaloriesNorm === 'number'
      && dailyCaloriesNorm > 0
      && defaultProteinCalories !== null
      && defaultFatCalories !== null
      ? dailyCaloriesNorm - defaultProteinCalories - defaultFatCalories
      : null

    return {
      proteins: defaultProteinGrams === null || defaultProteinCalories === null
        ? { grams: '', calories: '' }
        : {
            grams: formatCalculatorInput(defaultProteinGrams),
            calories: formatCalculatorInput(defaultProteinCalories),
          },
      fats: defaultFatCalories === null
        ? { grams: '', calories: '' }
        : {
            grams: formatCalculatorInput(defaultFatCalories / 9),
            calories: formatCalculatorInput(defaultFatCalories),
          },
      carbohydrates: defaultCarbohydrateCalories === null || defaultCarbohydrateCalories <= 0
        ? { grams: '', calories: '' }
        : {
            grams: formatCalculatorInput(defaultCarbohydrateCalories / 4),
            calories: formatCalculatorInput(defaultCarbohydrateCalories),
          },
    }
  })
  const [mode, setMode] = useState<MacroCalculatorMode>('calculator')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productWeight, setProductWeight] = useState('')
  const [productError, setProductError] = useState<string | null>(null)
  const [productEntries, setProductEntries] = useState<MacroCalculatorProductEntry[]>(
    () => loadMacroCalculatorProductEntries(userId),
  )

  const sortedSavedProducts = useMemo(
    () => [...savedProducts].sort((first, second) => first.name.localeCompare(second.name, 'ru-RU')),
    [savedProducts],
  )

  const updateValue = (
    key: MacroCalculatorKey,
    source: 'grams' | 'calories',
    value: string,
    calorieFactor: number,
  ) => {
    const parsed = parseCalculatorValue(value)
    const calculated = parsed === null
      ? ''
      : formatCalculatorInput(source === 'grams' ? parsed * calorieFactor : parsed / calorieFactor)

    setValues((current) => ({
      ...current,
      [key]: source === 'grams'
        ? { grams: value, calories: calculated }
        : { grams: calculated, calories: value },
    }))
  }

  const manualCalories = MACRO_CALCULATOR_FIELDS.reduce((total, field) => (
    total + (parseCalculatorValue(values[field.key].calories) ?? 0)
  ), 0)
  const productTotals = productEntries.reduce((totals, entry) => {
    const portion = entry.weightGrams / 100
    return {
      calories: totals.calories + entry.caloriesPer100g * portion,
      proteins: totals.proteins + entry.proteinsPer100g * portion,
      fats: totals.fats + entry.fatsPer100g * portion,
      carbohydrates: totals.carbohydrates + entry.carbohydratesPer100g * portion,
    }
  }, { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 })
  const remainingCalories = manualCalories - productTotals.calories
  const remainingProteins = (parseCalculatorValue(values.proteins.grams) ?? 0) - productTotals.proteins
  const remainingFats = (parseCalculatorValue(values.fats.grams) ?? 0) - productTotals.fats
  const remainingCarbohydrates = (parseCalculatorValue(values.carbohydrates.grams) ?? 0)
    - productTotals.carbohydrates

  const addProteinProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const product = savedProducts.find((item) => item.id === selectedProductId)
    const weight = parseCalculatorValue(productWeight)
    if (!product) {
      setProductError('Выберите продукт')
      return
    }
    if (weight === null || weight <= 0) {
      setProductError('Укажите вес больше нуля')
      return
    }

    setProductEntries((current) => [...current, {
      id: createMacroCalculatorEntryId(),
      productId: product.id,
      name: product.name,
      weightGrams: weight,
      caloriesPer100g: product.calories_per_100g,
      proteinsPer100g: product.proteins_per_100g,
      fatsPer100g: product.fats_per_100g,
      carbohydratesPer100g: product.carbohydrates_per_100g,
    }])
    setSelectedProductId('')
    setProductWeight('')
    setProductError(null)
  }

  useEffect(() => {
    saveMacroCalculatorProductEntries(userId, productEntries)
  }, [productEntries, userId])

  useEffect(() => {
    onBalanceValuesChange({
      proteins: remainingProteins > 0 ? remainingProteins : null,
      fats: remainingFats > 0 ? remainingFats : null,
    })
  }, [onBalanceValuesChange, remainingFats, remainingProteins])

  useEffect(() => {
    const proteins = parseCalculatorValue(values.proteins.grams)
    const fats = parseCalculatorValue(values.fats.grams)
    const carbohydrates = parseCalculatorValue(values.carbohydrates.grams)
    onTargetValuesChange({
      calories: manualCalories > 0 ? manualCalories : null,
      proteins: proteins !== null && proteins > 0 ? proteins : null,
      fats: fats !== null && fats > 0 ? fats : null,
      carbohydrates: carbohydrates !== null && carbohydrates > 0 ? carbohydrates : null,
    })
  }, [manualCalories, onTargetValuesChange, values.carbohydrates.grams, values.fats.grams, values.proteins.grams])

  return (
    <aside className="diary-macro-calculator" aria-labelledby="diary-macro-calculator-heading">
      <div className="diary-macro-calculator-head">
        <div>
          <h3 id="diary-macro-calculator-heading">Калькулятор КБЖУ</h3>
          <p>Белки и углеводы × 4, жиры × 9</p>
        </div>
        <button
          type="button"
          className="primary compact diary-macro-calculator-mode"
          aria-pressed={mode === 'protein'}
          onClick={() => {
            setMode((current) => current === 'calculator' ? 'protein' : 'calculator')
            setProductError(null)
          }}
        >
          {mode === 'calculator' ? 'Протеин' : 'Калькулятор'}
        </button>
      </div>
      {mode === 'calculator' ? (
        <div className="diary-macro-calculator-fields">
          {MACRO_CALCULATOR_FIELDS.map((field) => (
            <div className="diary-macro-calculator-row" key={field.key}>
              <label>
                <span>{field.label}, г</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={values[field.key].grams}
                  onChange={(event) => updateValue(field.key, 'grams', event.target.value, field.calorieFactor)}
                  placeholder="0"
                  aria-label={`${field.label}, граммы`}
                />
              </label>
              <span aria-hidden="true">=</span>
              <label>
                <span>Калории</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={values[field.key].calories}
                  onChange={(event) => updateValue(field.key, 'calories', event.target.value, field.calorieFactor)}
                  placeholder="0"
                  aria-label={`${field.label}, калории`}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <form className="diary-macro-calculator-protein-form" onSubmit={addProteinProduct}>
          <label className="diary-macro-calculator-product-select">
            <span>Продукт</span>
            <select
              value={selectedProductId}
              onChange={(event) => {
                setSelectedProductId(event.target.value)
                setProductError(null)
              }}
              disabled={sortedSavedProducts.length === 0}
            >
              <option value="">Выберите продукт</option>
              {sortedSavedProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Вес, г</span>
            <input
              type="text"
              inputMode="decimal"
              value={productWeight}
              onChange={(event) => {
                setProductWeight(event.target.value)
                setProductError(null)
              }}
              placeholder="0"
              disabled={sortedSavedProducts.length === 0}
            />
          </label>
          <button type="submit" className="primary compact" disabled={sortedSavedProducts.length === 0}>
            Добавить
          </button>
          {sortedSavedProducts.length === 0 && <p className="diary-macro-calculator-message">Сохранённых продуктов пока нет</p>}
          {productError && <p className="diary-macro-calculator-error">{productError}</p>}
        </form>
      )}
      {productEntries.length > 0 && (
        <div className="diary-macro-calculator-products">
          <strong>Добавленные продукты</strong>
          <ul>
            {productEntries.map((entry) => {
              const entryTotals = getMacroCalculatorEntryTotals(entry)
              return (
                <li key={entry.id}>
                  <div>
                    <span className="diary-macro-calculator-product-name">{entry.name} · {formatStatisticValue(entry.weightGrams, 1)} г</span>
                    <small>
                      К {formatStatisticValue(entryTotals.calories, 1)} ккал · Б {formatStatisticValue(entryTotals.proteins, 1)} г · Ж {formatStatisticValue(entryTotals.fats, 1)} г · У {formatStatisticValue(entryTotals.carbohydrates, 1)} г
                    </small>
                  </div>
                  <button
                    type="button"
                    className="delete-button"
                    aria-label={`Удалить ${entry.name} из калькулятора`}
                    title="Удалить"
                    onClick={() => setProductEntries((current) => current.filter((item) => item.id !== entry.id))}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {mode === 'calculator' ? (
        <div className="diary-macro-calculator-total calories-only">
          <span>Всего калорий</span>
          <strong>{formatStatisticValue(manualCalories, 1)} ккал</strong>
        </div>
      ) : (
        <div className="diary-macro-calculator-total">
          <span>Всего КБЖУ</span>
          <div className="diary-macro-calculator-total-values">
            <strong>К {formatStatisticValue(remainingCalories, 1)} ккал</strong>
            <strong>Б {formatStatisticValue(remainingProteins, 1)} г</strong>
            <strong>Ж {formatStatisticValue(remainingFats, 1)} г</strong>
            <strong>У {formatStatisticValue(remainingCarbohydrates, 1)} г</strong>
          </div>
        </div>
      )}
    </aside>
  )
}

function parseCalculatorValue(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function formatCalculatorInput(value: number) {
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

function getMacroCalculatorProductStorageKey(userId: string) {
  return `${MACRO_CALCULATOR_PRODUCTS_STORAGE_PREFIX}${userId}`
}

function loadMacroCalculatorProductEntries(userId: string | null): MacroCalculatorProductEntry[] {
  if (!userId) return []
  try {
    const rawValue = window.localStorage.getItem(getMacroCalculatorProductStorageKey(userId))
    if (!rawValue) return []
    const stored = JSON.parse(rawValue) as Partial<MacroCalculatorProductStorage>
    if (stored.version !== 1 || stored.userId !== userId || !Array.isArray(stored.entries)) return []
    return stored.entries.filter(isMacroCalculatorProductEntry)
  } catch {
    return []
  }
}

function saveMacroCalculatorProductEntries(userId: string | null, entries: MacroCalculatorProductEntry[]) {
  if (!userId) return
  const stored: MacroCalculatorProductStorage = { version: 1, userId, entries }
  try {
    window.localStorage.setItem(getMacroCalculatorProductStorageKey(userId), JSON.stringify(stored))
  } catch {
    // The calculator remains usable for the current session if browser storage is unavailable.
  }
}

function isMacroCalculatorProductEntry(value: unknown): value is MacroCalculatorProductEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string'
    && typeof entry.productId === 'string'
    && typeof entry.name === 'string'
    && entry.name.trim().length > 0
    && isFiniteNonNegativeNumber(entry.weightGrams, true)
    && isFiniteNonNegativeNumber(entry.caloriesPer100g)
    && isFiniteNonNegativeNumber(entry.proteinsPer100g)
    && isFiniteNonNegativeNumber(entry.fatsPer100g)
    && isFiniteNonNegativeNumber(entry.carbohydratesPer100g)
}

function isFiniteNonNegativeNumber(value: unknown, positive = false): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && (positive ? value > 0 : value >= 0)
}

function createMacroCalculatorEntryId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getMacroCalculatorEntryTotals(entry: MacroCalculatorProductEntry) {
  const portion = entry.weightGrams / 100
  return {
    calories: entry.caloriesPer100g * portion,
    proteins: entry.proteinsPer100g * portion,
    fats: entry.fatsPer100g * portion,
    carbohydrates: entry.carbohydratesPer100g * portion,
  }
}

function getSavedProductMacro(
  product: { proteins_per_100g: number; fats_per_100g: number; carbohydrates_per_100g: number },
  filter: MacroProductFilter,
) {
  if (filter === 'proteins') return product.proteins_per_100g
  if (filter === 'fats') return product.fats_per_100g
  return product.carbohydrates_per_100g
}

function getProteinFatBalanceDeviation(
  product: { proteins_per_100g: number; fats_per_100g: number },
  proteinTarget: number,
  fatTarget: number,
) {
  const productTotal = product.proteins_per_100g + product.fats_per_100g
  const targetTotal = proteinTarget + fatTarget
  if (productTotal <= 0 || targetTotal <= 0) return Number.POSITIVE_INFINITY

  const productProteinShare = product.proteins_per_100g / productTotal
  const targetProteinShare = proteinTarget / targetTotal
  return Math.abs(productProteinShare - targetProteinShare)
}

function StatisticValueComparison({
  label,
  actual,
  actualText,
  target,
  targetText,
  targetColor,
  actualSecondaryText,
  targetSecondaryText,
  labelExpanded,
  onLabelClick,
}: {
  label: string
  actual: number
  actualText: string
  target?: number
  targetText?: string
  targetColor?: string
  actualSecondaryText?: string
  targetSecondaryText?: string
  labelExpanded?: boolean
  onLabelClick?: () => void
}) {
  const showTarget = hasTarget(target) && targetText !== undefined && targetColor !== undefined

  return (
    <div className={`diary-statistics-comparison${showTarget ? ' has-target' : ''}`}>
      <div className="diary-statistics-value-head">
        {onLabelClick ? (
          <button
            type="button"
            className={`diary-statistics-filter-button${labelExpanded ? ' active' : ''}`}
            onClick={onLabelClick}
            aria-expanded={labelExpanded}
            title={`Показать сохранённые продукты: ${label.toLocaleLowerCase('ru-RU')}`}
          >
            {label}
            <span aria-hidden="true">{labelExpanded ? '⌃' : '⌄'}</span>
          </button>
        ) : <span>{label}</span>}
        {showTarget && (
          <>
            <span className="diary-statistics-head-spacer" aria-hidden="true" />
            <span>Цель</span>
          </>
        )}
      </div>
      <div className={`diary-statistics-value-row${showTarget ? ' has-target' : ''}`}>
        <div className="diary-statistics-value-stack">
          <strong style={showTarget ? { color: targetColor } : undefined}>{actualText}</strong>
          {actualSecondaryText && <small>{actualSecondaryText}</small>}
        </div>
        {showTarget && (
          <>
            <StatisticComparisonIndicator actual={actual} target={target} color={targetColor} />
            <div className="diary-statistics-value-stack diary-statistics-target-stack">
              <strong className="diary-statistics-target-number" style={{ color: targetColor }}>
                {targetText}
              </strong>
              {targetSecondaryText && <small>{targetSecondaryText}</small>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatisticComparisonIndicator({ actual, target, color }: { actual: number; target: number; color: string }) {
  const relation = getStatisticRelation(actual, target)
  const relationLabel = relation === 'equal'
    ? 'примерно равно цели'
    : relation === 'greater'
      ? 'больше цели'
      : 'меньше цели'

  return (
    <span
      className={`diary-statistics-comparison-indicator ${relation}`}
      style={{ color }}
      role="img"
      aria-label={`Фактическое значение ${relationLabel}`}
      title={relationLabel}
    >
      {relation === 'equal' ? '=' : (
        <svg viewBox="0 0 24 16" aria-hidden="true">
          <path d={relation === 'greater' ? 'M4 12 12 4l8 8' : 'm4 4 8 8 8-8'} />
        </svg>
      )}
    </span>
  )
}

function getStatisticRelation(actual: number, target: number): 'less' | 'equal' | 'greater' {
  const tolerance = Math.abs(target) * 0.05
  if (Math.abs(actual - target) <= tolerance) return 'equal'
  return actual > target ? 'greater' : 'less'
}

function formatMeasurementCount(value: number) {
  const lastTwoDigits = value % 100
  const lastDigit = value % 10
  const word = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? 'замеров'
    : lastDigit === 1
      ? 'замер'
      : lastDigit >= 2 && lastDigit <= 4
        ? 'замера'
        : 'замеров'
  return `${value} ${word}`
}

function getWorkedWeight(exercise: { exercise_type: string; weight_kg: number | null; repetitions: number | null; sets: number | null; double_volume: boolean }) {
  if (exercise.exercise_type !== 'Свободные веса / в блоке') return null
  if (exercise.weight_kg === null || exercise.repetitions === null || exercise.sets === null) return null
  const multiplier = exercise.double_volume ? 2 : 1
  return exercise.weight_kg * exercise.repetitions * exercise.sets * multiplier
}
