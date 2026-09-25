import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useData } from '../hooks/useData'
import type { DiaryStatisticsTargets } from '../lib/types'
import {
  dateTimeInputInTimeZone,
  getAdminTestTime,
  getSavedAdminTestDateTime,
  isAdminTestTimeRunning,
  saveAdminTestDateTime,
  startAdminTestTime,
} from '../lib/admin-test-time'
import { localISODate, parseISODate } from '../lib/dates'
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null)
  const [showProducts, setShowProducts] = useState(false)
  const [showNutritionStatistics, setShowNutritionStatistics] = useState(false)
  const [showNutritionPeriod, setShowNutritionPeriod] = useState(false)
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
  const [statisticsSettingsBusy, setStatisticsSettingsBusy] = useState(false)
  const [statisticsSettingsError, setStatisticsSettingsError] = useState<string | null>(null)
  const [nutritionCalendarSelection, setNutritionCalendarSelection] = useState<'start' | 'end'>('start')
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
  const statisticsTargets = profile?.diary_statistics_targets ?? {}
  const calculatedProteinTarget = typeof profile?.desired_weight === 'number' && profile.desired_weight > 0
    ? profile.desired_weight * macroCalculatorSettings.proteinWeightMultiplier
    : undefined
  const calculatedFatTarget = typeof profile?.daily_calories_norm === 'number' && profile.daily_calories_norm > 0
    ? (profile.daily_calories_norm * (macroCalculatorSettings.fatCaloriesPercent / 100)) / 9
    : undefined
  const defaultCarbohydrateTarget = typeof profile?.daily_calories_norm === 'number'
    && profile.daily_calories_norm > 0
    && calculatedProteinTarget !== undefined
    && calculatedFatTarget !== undefined
    ? (profile.daily_calories_norm - calculatedProteinTarget * 4 - calculatedFatTarget * 9) / 4
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
    }
  }, [nutritionPeriodFrom, nutritionPeriodTo, weightLogs])
  const firstWeekday = (activeMonth.getDay() + 6) % 7
  const daysInMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate()
  const emptyDays = Array.from({ length: firstWeekday })
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => index + 1)
  const statisticsMonthStart = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1))
  const statisticsMonthEnd = localISODate(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), daysInMonth))
  const today = adminMode && testDate ? testDate : localISODate()

  const previousMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setVisibleMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))
  }

  const selectDay = (day: number) => {
    const date = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day)
    const selectedIsoDate = localISODate(date)

    if (showNutritionStatistics && showNutritionPeriod) {
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
            <h2>
              {MONTHS[activeMonth.getMonth()]} {activeMonth.getFullYear()}
            </h2>
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
                  onClick={() => setShowNutritionStatistics((open) => !open)}
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
                    className="primary compact"
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
                      { label: 'Калории', actual: nutritionPeriodStatistics.calories, target: profile?.daily_calories_norm ?? undefined, unit: 'ккал', digits: 0, calorieMultiplier: undefined, productFilter: undefined },
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
                              label={days === 1 ? 'За сутки' : `За ${days} суток`}
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
                key={`${profile?.daily_calories_norm ?? 'no-calorie-norm'}-${profile?.desired_weight ?? 'no-desired-weight'}-${macroCalculatorSettings.fatCaloriesPercent}-${macroCalculatorSettings.proteinWeightMultiplier}`}
                dailyCaloriesNorm={profile?.daily_calories_norm}
                desiredWeight={profile?.desired_weight}
                settings={macroCalculatorSettings}
                onBalanceValuesChange={setMacroCalculatorBalanceValues}
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
    </section>
  )
}

function formatWeight(value: number) {
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
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

function isWeightTargetReached(actual: number, target: number) {
  return target < 0 ? actual <= target : actual >= target
}

type MacroCalculatorKey = 'proteins' | 'fats' | 'carbohydrates'

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
  onBalanceValuesChange,
}: {
  dailyCaloriesNorm?: number | null
  desiredWeight?: number | null
  settings: MacroCalculatorSettings
  onBalanceValuesChange: (values: MacroCalculatorBalanceValues) => void
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

  const totalCalories = MACRO_CALCULATOR_FIELDS.reduce((total, field) => (
    total + (parseCalculatorValue(values[field.key].calories) ?? 0)
  ), 0)

  useEffect(() => {
    onBalanceValuesChange({
      proteins: parseCalculatorValue(values.proteins.grams),
      fats: parseCalculatorValue(values.fats.grams),
    })
  }, [onBalanceValuesChange, values.fats.grams, values.proteins.grams])

  return (
    <aside className="diary-macro-calculator" aria-labelledby="diary-macro-calculator-heading">
      <div>
        <h3 id="diary-macro-calculator-heading">Калькулятор КБЖУ</h3>
        <p>Белки и углеводы × 4, жиры × 9</p>
      </div>
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
      <div className="diary-macro-calculator-total">
        <span>Всего калорий</span>
        <strong>{formatStatisticValue(totalCalories, 1)} ккал</strong>
      </div>
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

function getWorkedWeight(exercise: { exercise_type: string; weight_kg: number | null; repetitions: number | null; sets: number | null }) {
  if (exercise.exercise_type !== 'Свободные веса / в блоке') return null
  if (exercise.weight_kg === null || exercise.repetitions === null || exercise.sets === null) return null
  return exercise.weight_kg * exercise.repetitions * exercise.sets
}
