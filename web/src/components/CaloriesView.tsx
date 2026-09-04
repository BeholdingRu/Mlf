import { useEffect, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import { ProductsView } from './ProductsView'
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES, type ProductCategory } from '../lib/product-categories'

type CaloriesSubTab = 'consumption' | 'products'

const CALORIES_SUB_TAB_STORAGE_KEY = 'mlf:calories-sub-tab'
const FOOD_ADD_DRAFT_STORAGE_KEY = 'mlf:food-add-draft'

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
  return window.sessionStorage.getItem(CALORIES_SUB_TAB_STORAGE_KEY) === 'products'
    ? 'products'
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
  const { profile, foodLogs, savedProducts, addSavedProduct, logFoodToday, deleteFoodLog, saveCaloriesNorm } = useData()
  const [foodAddDraft] = useState<FoodAddDraft | null>(getSavedFoodAddDraft)
  const [subTab, setSubTab] = useState<CaloriesSubTab>(getSavedCaloriesSubTab)
  const [productName, setProductName] = useState(foodAddDraft?.name ?? '')
  const [weightGrams, setWeightGrams] = useState(foodAddDraft?.weightGrams ?? '')
  const [caloriesPer100g, setCaloriesPer100g] = useState(foodAddDraft?.calories ?? '')
  const [proteinsPer100g, setProteinsPer100g] = useState(foodAddDraft?.proteins ?? '')
  const [fatsPer100g, setFatsPer100g] = useState(foodAddDraft?.fats ?? '')
  const [carbohydratesPer100g, setCarbohydratesPer100g] = useState(foodAddDraft?.carbohydrates ?? '')
  const [productCategory, setProductCategory] = useState<ProductCategory>(foodAddDraft?.category ?? DEFAULT_PRODUCT_CATEGORY)
  const [savedProductGroup, setSavedProductGroup] = useState<ProductCategory | 'favorites' | ''>('')
  const [savedProductMenuOpen, setSavedProductMenuOpen] = useState(false)
  const [dailyNormInput, setDailyNormInput] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [savingNorm, setSavingNorm] = useState(false)
  const [editingNorm, setEditingNorm] = useState(false)
  const [normError, setNormError] = useState<string | null>(null)
  const dailyNormInputRef = useRef<HTMLInputElement>(null)

  const dailyNorm = profile?.daily_calories_norm ?? 0
  const displayedDailyNorm = dailyNormInput ?? (profile?.daily_calories_norm != null ? String(profile.daily_calories_norm) : '')

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

  useEffect(() => {
    window.sessionStorage.setItem(CALORIES_SUB_TAB_STORAGE_KEY, subTab)
  }, [subTab])

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
    const parsed = displayedDailyNorm.trim() === '' ? null : Number(displayedDailyNorm.replace(',', '.'))
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
  }

  const groupedSavedProducts = savedProductGroup === 'favorites'
    ? savedProducts.filter((product) => product.is_favorite)
    : savedProducts.filter((product) => product.category === savedProductGroup)

  return (
    <div className="calories-view">
      <nav className="calories-tabs">
        <button
          type="button"
          className={subTab === 'consumption' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => setSubTab('consumption')}
        >
          Потребление
        </button>
        <button
          type="button"
          className={subTab === 'products' ? 'calories-tab active' : 'calories-tab'}
          onClick={() => setSubTab('products')}
        >
          Продукты
        </button>
      </nav>

      <div className="calories-panel" hidden={subTab !== 'consumption'}>
        <>
          <div className="calories-header">
            <div className="calories-info">
              <div className="info-item calories-norm-card">
                <label className="label" htmlFor="daily-calories-norm">Дневная норма калорий:</label>
                <div className="daily-norm-editor">
                  {editingNorm ? (
                    <input
                      id="daily-calories-norm"
                      ref={dailyNormInputRef}
                      type="number"
                      step="1"
                      min="1"
                      value={displayedDailyNorm}
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
                {normError && <span className="daily-norm-error">{normError}</span>}
              </div>
              <div className="info-item consumption-card">
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
              </div>
              <div className="info-item remaining-card">
                <span className={`label remaining ${remaining >= 0 ? 'positive' : 'negative'}`}>
                  Осталось калорий:
                </span>
                <span className={`value ${remaining >= 0 ? 'positive' : 'negative'}`}>
                  {remaining.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          <form
            className="food-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAddFood()
            }}
          >
            <h3>Добавить продукт</h3>
            <fieldset className="nutrition-block">
              <legend>Название продукта</legend>
              <div className="product-name-row">
                <input
                  id="product-name"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Введите название продукта"
                  disabled={submitting}
                />
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
                  return (
                    <li key={food.id} className="food-item">
                      <div className="food-details">
                        <div className="food-name">{food.product_name}</div>
                        <div className="food-info">
                          <span>{food.weight_grams}г</span>
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
                      </div>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => handleDeleteFood(food.id, food.product_name)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      </div>
      <div className="calories-panel" hidden={subTab !== 'products'}>
        <ProductsView />
      </div>
    </div>
  )
}
