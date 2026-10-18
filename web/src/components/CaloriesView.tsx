import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../hooks/useData'
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES, type ProductCategory } from '../lib/product-categories'
import { getCalorieAdaptation } from '../lib/calorie-adaptation'
import { FluidSubtabIndicator } from './FluidSubtabIndicator'
import { getSavedMealGroupIds } from '../lib/saved-meal-groups'

type CaloriesSubTab = 'consumption' | 'products' | 'planner' | 'menu'

const CALORIES_SUB_TAB_STORAGE_KEY = 'mlf:calories-sub-tab'
const FOOD_ADD_DRAFT_STORAGE_KEY = 'mlf:food-add-draft'
const MOBILE_CALORIES_SUMMARY_QUERY = '(max-width: 768px)'

const MealMenuView = lazy(() => import('./MealMenuView').then((module) => ({
  default: module.MealMenuView,
})))
const MealPlannerView = lazy(() => import('./MealMenuView').then((module) => ({
  default: module.MealPlannerView,
})))
const ProductsView = lazy(() => import('./ProductsView').then((module) => ({
  default: module.ProductsView,
})))

type FoodAddDraft = {
  name: string
  weightGrams: string
  calories: string
  proteins: string
  fats: string
  carbohydrates: string
  category: ProductCategory
}

function getSavedCaloriesSubTab(): CaloriesSubTab {
  const storedTab = window.sessionStorage.getItem(CALORIES_SUB_TAB_STORAGE_KEY)
  return storedTab === 'products' || storedTab === 'planner' || storedTab === 'menu'
    ? storedTab
    : 'consumption'
}

function getSavedFoodAddDraft(): FoodAddDraft | null {
  try {
    const savedDraft = window.sessionStorage.getItem(FOOD_ADD_DRAFT_STORAGE_KEY)
    if (!savedDraft) return null

    const draft = JSON.parse(savedDraft) as Partial<FoodAddDraft>
    if (
      typeof draft.name !== 'string'
      || typeof draft.weightGrams !== 'string'
      || typeof draft.calories !== 'string'
      || typeof draft.proteins !== 'string'
      || typeof draft.fats !== 'string'
      || typeof draft.carbohydrates !== 'string'
      || !PRODUCT_CATEGORIES.includes(draft.category as ProductCategory)
    ) {
      window.sessionStorage.removeItem(FOOD_ADD_DRAFT_STORAGE_KEY)
      return null
    }

    return {
      name: draft.name,
      weightGrams: draft.weightGrams,
      calories: draft.calories,
      proteins: draft.proteins,
      fats: draft.fats,
      carbohydrates: draft.carbohydrates,
      category: draft.category as ProductCategory,
    }
  } catch {
    window.sessionStorage.removeItem(FOOD_ADD_DRAFT_STORAGE_KEY)
    return null
  }
}

export function CaloriesView() {
  const {
    profile,
    weightLogs,
    foodLogs,
    savedProducts,
    savedMeals,
    savedMealPlans,
    addSavedProduct,
    setSavedProductFavorite,
    logFoodToday,
    updateFoodLogWeight,
    deleteFoodLog,
    saveCaloriesNorm,
    saveCalorieAdaptationEnabled,
    syncSavedMealPlanGrouping,
  } = useData()
  const [foodAddDraft] = useState<FoodAddDraft | null>(getSavedFoodAddDraft)
  const [subTab, setSubTab] = useState<CaloriesSubTab>(getSavedCaloriesSubTab)
  const [mountedSubTabs, setMountedSubTabs] = useState<Set<CaloriesSubTab>>(
    () => new Set([subTab]),
  )
  const [productName, setProductName] = useState(foodAddDraft?.name ?? '')
  const [weightGrams, setWeightGrams] = useState(foodAddDraft?.weightGrams ?? '')
  const [caloriesPer100g, setCaloriesPer100g] = useState(foodAddDraft?.calories ?? '')
  const [proteinsPer100g, setProteinsPer100g] = useState(foodAddDraft?.proteins ?? '')
  const [fatsPer100g, setFatsPer100g] = useState(foodAddDraft?.fats ?? '')
  const [carbohydratesPer100g, setCarbohydratesPer100g] = useState(foodAddDraft?.carbohydrates ?? '')
  const [productCategory, setProductCategory] = useState<ProductCategory>(foodAddDraft?.category ?? DEFAULT_PRODUCT_CATEGORY)
  const [savedProductGroup, setSavedProductGroup] = useState<ProductCategory | 'favorites' | ''>('')
  const [savedProductMenuOpen, setSavedProductMenuOpen] = useState(false)
  const [productSuggestionsOpen, setProductSuggestionsOpen] = useState(false)
  const [dailyNormInput, setDailyNormInput] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [favoriteFoodId, setFavoriteFoodId] = useState<string | null>(null)
  const [editingFoodWeightId, setEditingFoodWeightId] = useState<string | null>(null)
  const [foodWeightInput, setFoodWeightInput] = useState('')
  const [savingFoodWeightId, setSavingFoodWeightId] = useState<string | null>(null)
  const [foodWeightError, setFoodWeightError] = useState<string | null>(null)
  const [savingNorm, setSavingNorm] = useState(false)
  const [savingAdaptation, setSavingAdaptation] = useState(false)
  const [editingNorm, setEditingNorm] = useState(false)
  const [normError, setNormError] = useState<string | null>(null)
  const [adaptationInfoOpen, setAdaptationInfoOpen] = useState(false)
  const [mobileCaloriesSummary, setMobileCaloriesSummary] = useState(
    () => window.matchMedia(MOBILE_CALORIES_SUMMARY_QUERY).matches,
  )
  const [caloriesSummaryExpanded, setCaloriesSummaryExpanded] = useState(false)
  const [mealPlanSyncError, setMealPlanSyncError] = useState<string | null>(null)
  const dailyNormInputRef = useRef<HTMLInputElement>(null)
  const adaptationInfoRef = useRef<HTMLDivElement>(null)
  const adaptationInfoButtonRef = useRef<HTMLButtonElement>(null)
  const mealPlanSyncRef = useRef<{
    sync: (groups: string[][]) => Promise<void>
    groups: string[][]
    running: boolean
    pending: boolean
    timer: number | null
    retryCount: number
  }>({
    sync: syncSavedMealPlanGrouping,
    groups: [],
    running: false,
    pending: false,
    timer: null,
    retryCount: 0,
  })

  const savedMealGroupIds = useMemo(() => getSavedMealGroupIds(savedMeals), [savedMeals])
  const mealGroupingSignature = useMemo(
    () => savedMealGroupIds.map((mealIds) => mealIds.join(':')).join('|'),
    [savedMealGroupIds],
  )
  const savedMealIdentitySignature = useMemo(
    () => savedMeals.map((meal) => meal.id).sort().join('|'),
    [savedMeals],
  )

  const calorieAdaptation = getCalorieAdaptation(profile, weightLogs)
  const dailyNorm = calorieAdaptation.effectiveNorm ?? 0
  const editableDailyNorm = dailyNormInput ?? (calorieAdaptation.baseNorm != null ? String(calorieAdaptation.baseNorm) : '')
  const displayedDailyNorm = calorieAdaptation.effectiveNorm != null ? String(calorieAdaptation.effectiveNorm) : ''

  const totalConsumed = foodLogs.reduce((sum, food) => {
    const consumed = (food.weight_grams / 100) * food.calories_per_100g
    return sum + consumed
  }, 0)

  const totalNutrition = foodLogs.reduce((totals, food) => {
    const multiplier = food.weight_grams / 100
    return {
      proteins: totals.proteins + multiplier * food.proteins_per_100g,
      fats: totals.fats + multiplier * food.fats_per_100g,
      carbohydrates: totals.carbohydrates + multiplier * food.carbohydrates_per_100g,
    }
  }, { proteins: 0, fats: 0, carbohydrates: 0 })

  const remaining = dailyNorm - totalConsumed
  const productSuggestions = useMemo(() => {
    const query = productName.trim().toLocaleLowerCase('ru-RU')
    if (!query) return []
    return savedProducts
      .filter((product) => product.name.trim().toLocaleLowerCase('ru-RU').includes(query))
      .slice(0, 6)
  }, [productName, savedProducts])

  useEffect(() => {
    window.sessionStorage.setItem(CALORIES_SUB_TAB_STORAGE_KEY, subTab)
  }, [subTab])

  useEffect(() => {
    mealPlanSyncRef.current.sync = syncSavedMealPlanGrouping
    mealPlanSyncRef.current.groups = savedMealGroupIds
  }, [savedMealGroupIds, syncSavedMealPlanGrouping])

  useEffect(() => {
    const coordinator = mealPlanSyncRef.current
    coordinator.pending = true
    coordinator.retryCount = 0
    if (coordinator.running) return undefined
    if (coordinator.timer !== null) window.clearTimeout(coordinator.timer)

    coordinator.timer = window.setTimeout(() => {
      coordinator.timer = null
      coordinator.running = true
      const synchronize = async () => {
        do {
          coordinator.pending = false
          try {
            await coordinator.sync(coordinator.groups)
            coordinator.retryCount = 0
            setMealPlanSyncError(null)
          } catch (syncError) {
            setMealPlanSyncError(syncError instanceof Error
              ? syncError.message
              : 'Не удалось синхронизировать меню с планировщиком')
            if (coordinator.retryCount < 2) {
              coordinator.retryCount += 1
              await new Promise<void>((resolve) => {
                window.setTimeout(resolve, coordinator.retryCount * 1_500)
              })
              coordinator.pending = true
            }
          }
        } while (coordinator.pending)
        coordinator.running = false
      }
      void synchronize()
    }, 120)

    return () => {
      if (coordinator.timer !== null && !coordinator.running) {
        window.clearTimeout(coordinator.timer)
        coordinator.timer = null
      }
    }
  }, [mealGroupingSignature, savedMealIdentitySignature, savedMealPlans.length])

  const openSubTab = (nextSubTab: CaloriesSubTab) => {
    setMountedSubTabs((current) => (
      current.has(nextSubTab) ? current : new Set(current).add(nextSubTab)
    ))
    setSubTab(nextSubTab)
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_CALORIES_SUMMARY_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setMobileCaloriesSummary(event.matches)
      if (event.matches) setCaloriesSummaryExpanded(false)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  useEffect(() => {
    if (!adaptationInfoOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!adaptationInfoRef.current?.contains(event.target as Node)) {
        setAdaptationInfoOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setAdaptationInfoOpen(false)
      adaptationInfoButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [adaptationInfoOpen])

  useEffect(() => {
    const isEmpty = !productName && !weightGrams && !caloriesPer100g && !proteinsPer100g
      && !fatsPer100g && !carbohydratesPer100g && productCategory === DEFAULT_PRODUCT_CATEGORY
    if (isEmpty) {
      window.sessionStorage.removeItem(FOOD_ADD_DRAFT_STORAGE_KEY)
      return
    }

    const draft: FoodAddDraft = {
      name: productName,
      weightGrams,
      calories: caloriesPer100g,
      proteins: proteinsPer100g,
      fats: fatsPer100g,
      carbohydrates: carbohydratesPer100g,
      category: productCategory,
    }
    window.sessionStorage.setItem(FOOD_ADD_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [caloriesPer100g, carbohydratesPer100g, fatsPer100g, productCategory, productName, proteinsPer100g, weightGrams])

  const handleSaveDailyNorm = async () => {
    const parsed = editableDailyNorm.trim() === '' ? null : Number(editableDailyNorm.replace(',', '.'))
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      setNormError('Укажите положительное значение для дневной нормы калорий')
      return
    }

    setSavingNorm(true)
    setNormError(null)
    try {
      await saveCaloriesNorm(parsed)
      setDailyNormInput(parsed != null ? String(parsed) : '')
      setEditingNorm(false)
    } catch (err) {
      setNormError(err instanceof Error ? err.message : 'Не удалось сохранить дневную норму калорий')
    } finally {
      setSavingNorm(false)
    }
  }

  const handleEditDailyNorm = () => {
    setNormError(null)
    setEditingNorm(true)
    requestAnimationFrame(() => dailyNormInputRef.current?.focus())
  }

  const handleCalorieAdaptationChange = async (enabled: boolean) => {
    setSavingAdaptation(true)
    setNormError(null)
    try {
      await saveCalorieAdaptationEnabled(enabled)
    } catch (err) {
      setNormError(err instanceof Error ? err.message : 'Не удалось сохранить настройку адаптации')
    } finally {
      setSavingAdaptation(false)
    }
  }

  const handleAddFood = async () => {
    const proteins = Number(proteinsPer100g)
    const fats = Number(fatsPer100g)
    const carbohydrates = Number(carbohydratesPer100g)
    if (!productName.trim() || !weightGrams || !caloriesPer100g
      || !Number.isFinite(proteins) || proteins < 0
      || !Number.isFinite(fats) || fats < 0
      || !Number.isFinite(carbohydrates) || carbohydrates < 0) {
      alert('Пожалуйста, заполните все поля')
      return
    }

    setSubmitting(true)
    try {
      const name = productName.trim()
      const calories = parseFloat(caloriesPer100g)
      const isAlreadySaved = savedProducts.some(
        (product) => product.name.trim().toLocaleLowerCase('ru-RU') === name.toLocaleLowerCase('ru-RU'),
      )

      if (!isAlreadySaved) {
        await addSavedProduct(
          name,
          calories,
          proteins,
          fats,
          carbohydrates,
          productCategory,
          false,
        )
      }

      await logFoodToday(
        name,
        parseFloat(weightGrams),
        calories,
        proteins,
        fats,
        carbohydrates,
      )
      window.sessionStorage.removeItem(FOOD_ADD_DRAFT_STORAGE_KEY)
      setProductName('')
      setWeightGrams('')
      setCaloriesPer100g('')
      setProteinsPer100g('')
      setFatsPer100g('')
      setCarbohydratesPer100g('')
      setProductCategory(DEFAULT_PRODUCT_CATEGORY)
    } catch (err) {
      console.error('Error logging food:', err)
      alert('Ошибка при сохранении продукта')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteFood = async (id: string, productName: string) => {
    const confirmed = window.confirm(`Удалить «${productName}» из продуктов за сегодня?`)
    if (!confirmed) return

    try {
      await deleteFoodLog(id)
    } catch (err) {
      console.error('Error deleting food:', err)
      alert('Ошибка при удалении продукта')
    }
  }

  const startFoodWeightEditing = (food: typeof foodLogs[number]) => {
    setEditingFoodWeightId(food.id)
    setFoodWeightInput(String(food.weight_grams))
    setFoodWeightError(null)
  }

  const cancelFoodWeightEditing = () => {
    setEditingFoodWeightId(null)
    setFoodWeightInput('')
    setFoodWeightError(null)
  }

  const handleSaveFoodWeight = async (foodId: string) => {
    const weight = Number(foodWeightInput.replace(',', '.'))
    if (!Number.isFinite(weight) || weight <= 0) {
      setFoodWeightError('Укажите граммовку больше нуля')
      return
    }

    setSavingFoodWeightId(foodId)
    setFoodWeightError(null)
    try {
      await updateFoodLogWeight(foodId, weight)
      cancelFoodWeightEditing()
    } catch (err) {
      setFoodWeightError(err instanceof Error ? err.message : 'Не удалось изменить граммовку')
    } finally {
      setSavingFoodWeightId(null)
    }
  }

  const handleFoodFavoriteChange = async (food: typeof foodLogs[number], isFavorite: boolean) => {
    setFavoriteFoodId(food.id)
    try {
      const normalizedName = food.product_name.trim().toLocaleLowerCase('ru-RU')
      const savedProduct = savedProducts.find(
        (product) => product.name.trim().toLocaleLowerCase('ru-RU') === normalizedName,
      )

      if (savedProduct) {
        await setSavedProductFavorite(savedProduct.id, isFavorite)
        return
      }

      if (!isFavorite) return

      await addSavedProduct(
        food.product_name,
        food.calories_per_100g,
        food.proteins_per_100g,
        food.fats_per_100g,
        food.carbohydrates_per_100g,
        DEFAULT_PRODUCT_CATEGORY,
        true,
      )
    } catch (err) {
      console.error('Error adding food to favorites:', err)
      alert('Не удалось добавить продукт в избранное')
    } finally {
      setFavoriteFoodId(null)
    }
  }

  const selectSavedProduct = (id: string) => {
    const product = savedProducts.find((item) => item.id === id)
    if (!product) return
    setProductName(product.name)
    setCaloriesPer100g(String(product.calories_per_100g))
    setProteinsPer100g(String(product.proteins_per_100g))
    setFatsPer100g(String(product.fats_per_100g))
    setCarbohydratesPer100g(String(product.carbohydrates_per_100g))
    setProductCategory(product.category)
    setSavedProductMenuOpen(false)
    setProductSuggestionsOpen(false)
  }

  const groupedSavedProducts = savedProductGroup === 'favorites'
    ? savedProducts.filter((product) => product.is_favorite)
    : savedProducts.filter((product) => product.category === savedProductGroup)

  return (
    <div className="calories-view calorie-accounting-view">
      <nav className="calories-tabs">
        <FluidSubtabIndicator activeKey={subTab} />
        <button
          type="button"
          className={subTab === 'consumption' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => openSubTab('consumption')}
        >
          Потребление
        </button>
        <button
          type="button"
          className={subTab === 'planner' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => openSubTab('planner')}
        >
          Планировщик
        </button>
        <button
          type="button"
          className={subTab === 'menu' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => openSubTab('menu')}
        >
          Меню
        </button>
        <button
          type="button"
          className={subTab === 'products' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => openSubTab('products')}
        >
          Продукты
        </button>
      </nav>
      {mealPlanSyncError && <p className="banner error">{mealPlanSyncError}</p>}

      {mountedSubTabs.has('consumption') && <div className="calories-panel" hidden={subTab !== 'consumption'}>
        <>
          <div className="calories-header">
            <div className="calories-info">
              {(!mobileCaloriesSummary || caloriesSummaryExpanded) && <div className="info-item calories-norm-card">
                <label className="label" htmlFor="daily-calories-norm">Дневная норма калорий:</label>
                <div className="daily-norm-controls" ref={adaptationInfoRef}>
                  <div className="daily-norm-editor">
                    {editingNorm ? (
                      <input
                        id="daily-calories-norm"
                        ref={dailyNormInputRef}
                        type="number"
                        step="1"
                        min="1"
                        value={editableDailyNorm}
                        onChange={(e) => setDailyNormInput(e.target.value)}
                        disabled={savingNorm}
                        placeholder="Не задана"
                      />
                    ) : (
                      <span className="daily-norm-value">{displayedDailyNorm || '—'}</span>
                    )}
                    <button
                      type="button"
                      className={editingNorm ? 'primary compact daily-norm-action' : 'edit-button daily-norm-action'}
                      onClick={editingNorm ? handleSaveDailyNorm : handleEditDailyNorm}
                      disabled={savingNorm}
                      aria-label={editingNorm ? undefined : 'Редактировать дневную норму калорий'}
                      title={editingNorm ? undefined : 'Редактировать дневную норму калорий'}
                    >
                      {savingNorm ? 'Сохранение…' : editingNorm ? 'Сохранить' : '✎'}
                    </button>
                  </div>
                  <div className="calorie-adaptation-control">
                    <label className="calorie-adaptation-toggle">
                      <input
                        type="checkbox"
                        checked={profile?.calorie_adaptation_enabled ?? false}
                        disabled={savingAdaptation}
                        onChange={(event) => void handleCalorieAdaptationChange(event.target.checked)}
                      />
                      <span>Адаптация</span>
                    </label>
                    <button
                      ref={adaptationInfoButtonRef}
                      type="button"
                      className="info-button calorie-adaptation-info-button"
                      aria-label="Информация об адаптации дневной нормы калорий"
                      aria-expanded={adaptationInfoOpen}
                      aria-controls="calorie-adaptation-info"
                      aria-describedby={adaptationInfoOpen ? 'calorie-adaptation-info' : undefined}
                      onClick={() => setAdaptationInfoOpen((open) => !open)}
                    >
                      i
                    </button>
                  </div>
                  {adaptationInfoOpen && (
                    <div id="calorie-adaptation-info" className="calorie-adaptation-info" role="tooltip">
                      Если активно, изменение веса считается от момента сохранения нормы: за каждый набранный
                      килограмм добавляется 10 ккал, за каждый потерянный — вычитается 10 ккал.
                    </div>
                  )}
                </div>
                {normError && <span className="daily-norm-error" role="alert">{normError}</span>}
              </div>}
              {(!mobileCaloriesSummary || caloriesSummaryExpanded) && <div className="info-item consumption-card">
                <div className="consumption-summary" aria-label="Потреблённые калории и сумма БЖУ">
                  <div className="consumption-summary-item calories">
                    <span>Потреблено</span>
                    <strong>{totalConsumed.toFixed(0)}</strong>
                  </div>
                  <div className="consumption-summary-item">
                    <span>Б</span>
                    <strong>{totalNutrition.proteins.toFixed(1)}</strong>
                  </div>
                  <div className="consumption-summary-item">
                    <span>Ж</span>
                    <strong>{totalNutrition.fats.toFixed(1)}</strong>
                  </div>
                  <div className="consumption-summary-item">
                    <span>У</span>
                    <strong>{totalNutrition.carbohydrates.toFixed(1)}</strong>
                  </div>
                </div>
              </div>}
              {mobileCaloriesSummary ? (
                <button
                  type="button"
                  className="info-item remaining-card calories-summary-toggle"
                  aria-expanded={caloriesSummaryExpanded}
                  aria-label={`Осталось калорий: ${remaining.toFixed(0)}. ${caloriesSummaryExpanded ? 'Свернуть' : 'Развернуть'} сводку`}
                  onClick={() => setCaloriesSummaryExpanded((expanded) => !expanded)}
                >
                  <span className={`label remaining ${remaining >= 0 ? 'positive' : 'negative'}`}>
                    Осталось калорий:
                  </span>
                  <span className={`value ${remaining >= 0 ? 'positive' : 'negative'}`}>
                    {remaining.toFixed(0)}
                  </span>
                  <span className="calories-summary-chevron" aria-hidden="true">
                    {caloriesSummaryExpanded ? '⌃' : '⌄'}
                  </span>
                </button>
              ) : (
                <div className="info-item remaining-card">
                  <span className={`label remaining ${remaining >= 0 ? 'positive' : 'negative'}`}>
                    Осталось калорий:
                  </span>
                  <span className={`value ${remaining >= 0 ? 'positive' : 'negative'}`}>
                    {remaining.toFixed(0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <form
            className="food-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAddFood()
            }}
          >
            <fieldset className="nutrition-block">
              <legend>Добавить продукт</legend>
              <div className="product-name-row">
                <div
                  className="product-name-autocomplete"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setProductSuggestionsOpen(false)
                  }}
                >
                  <input
                    id="product-name"
                    type="text"
                    value={productName}
                    onChange={(event) => {
                      setProductName(event.target.value)
                      setProductSuggestionsOpen(true)
                    }}
                    onFocus={() => setProductSuggestionsOpen(true)}
                    placeholder="Введите название продукта"
                    disabled={submitting}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={productSuggestionsOpen && productSuggestions.length > 0}
                    aria-controls="product-name-suggestions"
                  />
                  {productSuggestionsOpen && productSuggestions.length > 0 && (
                    <div id="product-name-suggestions" className="product-name-suggestions" role="listbox">
                      {productSuggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="product-name-suggestion"
                          role="option"
                          aria-selected={false}
                          onClick={() => selectSavedProduct(product.id)}
                        >
                          <strong>{product.name}</strong>
                          <span>{product.calories_per_100g} ккал · Б {product.proteins_per_100g} · Ж {product.fats_per_100g} · У {product.carbohydrates_per_100g}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="saved-products-picker">
                  <button
                    type="button"
                    className="saved-products-trigger"
                    aria-haspopup="true"
                    aria-expanded={savedProductMenuOpen}
                    disabled={submitting || savedProducts.length === 0}
                  onClick={() => setSavedProductMenuOpen((open) => !open)}
                  >
                    {savedProducts.length ? 'Продукты' : 'Нет продуктов'}
                  </button>
                  {savedProductMenuOpen && (
                    <div className="saved-products-menu" aria-label="Сохранённые продукты">
                      {savedProductGroup ? (
                        <>
                          <button
                            type="button"
                            className="saved-products-back"
                            onClick={() => setSavedProductGroup('')}
                          >
                            ← Все категории
                          </button>
                          <p className="saved-product-category-title">
                            {savedProductGroup === 'favorites' ? 'Избранное' : savedProductGroup}
                          </p>
                          <div className="saved-product-options">
                            {groupedSavedProducts.length ? groupedSavedProducts.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className="saved-product-option"
                                onClick={() => selectSavedProduct(product.id)}
                              >
                                <span>{product.name}</span>
                                <span>{product.calories_per_100g} ккал · Б {product.proteins_per_100g} · Ж {product.fats_per_100g} · У {product.carbohydrates_per_100g}</span>
                              </button>
                            )) : (
                              <p className="saved-products-empty">В этой категории нет продуктов</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="saved-product-category"
                            onClick={() => setSavedProductGroup('favorites')}
                          >
                            Избранное
                          </button>
                          {PRODUCT_CATEGORIES.map((category) => (
                            <button
                              key={category}
                              type="button"
                              className="saved-product-category"
                              onClick={() => setSavedProductGroup(category)}
                            >
                              {category}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>
            <div className="form-group product-category-group">
              <label htmlFor="consumption-category">Категория для «Моих продуктов»</label>
              <select
                id="consumption-category"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value as ProductCategory)}
                disabled={submitting}
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <fieldset className="nutrition-block">
              <legend>КБЖУ на 100 г</legend>
              <div className="nutrition-inputs nutrition-inputs-four">
                <div className="form-group">
                  <label htmlFor="calories">Ккал</label>
                  <input id="calories" type="number" value={caloriesPer100g} onChange={(e) => setCaloriesPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
                <div className="form-group">
                  <label htmlFor="consumption-proteins">Белки</label>
                  <input id="consumption-proteins" type="number" value={proteinsPer100g} onChange={(e) => setProteinsPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
                <div className="form-group">
                  <label htmlFor="consumption-fats">Жиры</label>
                  <input id="consumption-fats" type="number" value={fatsPer100g} onChange={(e) => setFatsPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
                <div className="form-group">
                  <label htmlFor="consumption-carbohydrates">Углеводы</label>
                  <input id="consumption-carbohydrates" type="number" value={carbohydratesPer100g} onChange={(e) => setCarbohydratesPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
              </div>
            </fieldset>
            <fieldset className="nutrition-block">
              <legend>Вес продукта</legend>
              <div className="form-group">
                <label htmlFor="weight">Граммы</label>
                <input
                  id="weight"
                  type="number"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    void handleAddFood()
                  }}
                  placeholder="0"
                  disabled={submitting}
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  enterKeyHint="done"
                />
              </div>
            </fieldset>
            <button type="submit" disabled={submitting} className="add-button">
              {submitting ? 'Сохранение...' : 'Добавить'}
            </button>
          </form>

          <div className="food-list">
            <h3>Продукты за сегодня</h3>
            {foodLogs.length === 0 ? (
              <p className="empty">Продукты не добавлены</p>
            ) : (
              <ul>
                {foodLogs.map((food) => {
                  const consumed = (food.weight_grams / 100) * food.calories_per_100g
                  const savedProduct = savedProducts.find(
                    (product) => product.name.trim().toLocaleLowerCase('ru-RU') === food.product_name.trim().toLocaleLowerCase('ru-RU'),
                  )
                  return (
                    <li key={food.id} className="food-item">
                      <div className="food-details">
                        <div className="food-name">{food.product_name}</div>
                        <div className="food-info">
                          {editingFoodWeightId === food.id ? (
                            <label className="food-weight-editor">
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                inputMode="decimal"
                                value={foodWeightInput}
                                onChange={(event) => {
                                  setFoodWeightInput(event.target.value)
                                  setFoodWeightError(null)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== 'Enter' || event.repeat) return
                                  event.preventDefault()
                                  void handleSaveFoodWeight(food.id)
                                }}
                                disabled={savingFoodWeightId === food.id}
                                aria-label={`Граммовка продукта «${food.product_name}»`}
                                autoFocus
                              />
                              <span>г</span>
                            </label>
                          ) : <span>{food.weight_grams}г</span>}
                          <span>•</span>
                          <span>{food.calories_per_100g} ккал/100г</span>
                          <span>•</span>
                          <span>Б {((food.weight_grams / 100) * food.proteins_per_100g).toFixed(1)} г</span>
                          <span>•</span>
                          <span>Ж {((food.weight_grams / 100) * food.fats_per_100g).toFixed(1)} г</span>
                          <span>•</span>
                          <span>У {((food.weight_grams / 100) * food.carbohydrates_per_100g).toFixed(1)} г</span>
                          <span>•</span>
                          <span className="consumed">{consumed.toFixed(0)} ккал</span>
                        </div>
                        {editingFoodWeightId === food.id && foodWeightError && (
                          <p className="food-weight-error" role="alert">{foodWeightError}</p>
                        )}
                      </div>
                      <div className="food-actions">
                        <label className="favorite-control" title={savedProduct?.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}>
                          <input
                            type="checkbox"
                            checked={savedProduct?.is_favorite ?? false}
                            disabled={favoriteFoodId === food.id}
                            onChange={(event) => void handleFoodFavoriteChange(food, event.target.checked)}
                            aria-label={`${savedProduct?.is_favorite ? 'Убрать' : 'Добавить'} ${food.product_name} ${savedProduct?.is_favorite ? 'из' : 'в'} избранного`}
                          />
                          <span aria-hidden="true">★</span>
                        </label>
                        {editingFoodWeightId === food.id ? (
                          <>
                            <button
                              type="button"
                              className="food-weight-save-button"
                              onClick={() => void handleSaveFoodWeight(food.id)}
                              disabled={savingFoodWeightId === food.id}
                              aria-label={`Сохранить граммовку продукта «${food.product_name}»`}
                              title="Сохранить граммовку"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="food-weight-cancel-button"
                              onClick={cancelFoodWeightEditing}
                              disabled={savingFoodWeightId === food.id}
                              aria-label="Отменить изменение граммовки"
                              title="Отмена"
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="edit-button"
                              onClick={() => startFoodWeightEditing(food)}
                              aria-label={`Изменить граммовку продукта «${food.product_name}»`}
                              title="Изменить граммовку"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="delete-button"
                              onClick={() => handleDeleteFood(food.id, food.product_name)}
                              title="Удалить"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      </div>}
      {mountedSubTabs.has('planner') && <div className="calories-panel" hidden={subTab !== 'planner'}>
        <Suspense fallback={<p className="muted">Загрузка планировщика…</p>}>
          <MealPlannerView />
        </Suspense>
      </div>}
      {mountedSubTabs.has('menu') && <div className="calories-panel" hidden={subTab !== 'menu'}>
        <Suspense fallback={<p className="muted">Загрузка меню…</p>}>
          <MealMenuView />
        </Suspense>
      </div>}
      {mountedSubTabs.has('products') && <div className="calories-panel" hidden={subTab !== 'products'}>
        <Suspense fallback={<p className="muted">Загрузка продуктов…</p>}>
          <ProductsView />
        </Suspense>
      </div>}
    </div>
  )
}
