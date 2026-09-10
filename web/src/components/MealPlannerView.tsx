import { useState } from 'react'
import { useData } from '../hooks/useData'
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES, type ProductCategory } from '../lib/product-categories'
import type { MealPlanEntry, MealType } from '../lib/types'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Завтрак' },
  { type: 'lunch', label: 'Обед' },
  { type: 'dinner', label: 'Ужин' },
]

export function MealPlannerView() {
  const { mealPlanEntries, savedProducts, addSavedProduct, addMealPlanEntry, deleteMealPlanEntry, logFoodToday } = useData()
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [productName, setProductName] = useState('')
  const [caloriesPer100g, setCaloriesPer100g] = useState('')
  const [proteinsPer100g, setProteinsPer100g] = useState('')
  const [fatsPer100g, setFatsPer100g] = useState('')
  const [carbohydratesPer100g, setCarbohydratesPer100g] = useState('')
  const [productCategory, setProductCategory] = useState<ProductCategory>(DEFAULT_PRODUCT_CATEGORY)
  const [savedProductGroup, setSavedProductGroup] = useState<ProductCategory | 'favorites' | ''>('')
  const [savedProductMenuOpen, setSavedProductMenuOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copyingEntry, setCopyingEntry] = useState<MealPlanEntry | null>(null)
  const [copyWeightGrams, setCopyWeightGrams] = useState('')
  const [copying, setCopying] = useState(false)

  const selectedMealLabel = MEALS.find((meal) => meal.type === selectedMeal)?.label
  const selectedMealEntries = mealPlanEntries.filter(
    (entry) => entry.meal_type === selectedMeal,
  )
  const groupedSavedProducts = savedProductGroup === 'favorites'
    ? savedProducts.filter((product) => product.is_favorite)
    : savedProducts.filter((product) => product.category === savedProductGroup)

  function selectMeal(mealType: MealType) {
    setSelectedMeal((currentMeal) => currentMeal === mealType ? null : mealType)
    setAddFormOpen(false)
    setSavedProductMenuOpen(false)
    setSavedProductGroup('')
  }

  function selectSavedProduct(id: string) {
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

  async function handleAddProduct() {
    if (!selectedMeal) return

    const proteins = Number(proteinsPer100g)
    const fats = Number(fatsPer100g)
    const carbohydrates = Number(carbohydratesPer100g)
    if (!productName.trim() || !caloriesPer100g
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
        await addSavedProduct(name, calories, proteins, fats, carbohydrates, productCategory, false)
      }

      await addMealPlanEntry(
        selectedMeal,
        name,
        calories,
        proteins,
        fats,
        carbohydrates,
      )
      setProductName('')
      setCaloriesPer100g('')
      setProteinsPer100g('')
      setFatsPer100g('')
      setCarbohydratesPer100g('')
      setProductCategory(DEFAULT_PRODUCT_CATEGORY)
    } catch (error) {
      console.error('Error saving meal plan entry:', error)
      alert('Ошибка при сохранении продукта')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteProduct(id: string, name: string) {
    if (!window.confirm(`Удалить «${name}» из плана «${selectedMealLabel}»?`)) return

    try {
      await deleteMealPlanEntry(id)
    } catch (error) {
      console.error('Error deleting meal plan entry:', error)
      alert('Ошибка при удалении продукта')
    }
  }

  async function copyToConsumption() {
    if (!copyingEntry) return
    const weight = Number(copyWeightGrams)
    if (!Number.isFinite(weight) || weight <= 0) {
      alert('Введите корректный вес продукта')
      return
    }

    setCopying(true)
    try {
      await logFoodToday(
        copyingEntry.product_name,
        weight,
        copyingEntry.calories_per_100g,
        copyingEntry.proteins_per_100g,
        copyingEntry.fats_per_100g,
        copyingEntry.carbohydrates_per_100g,
      )
      setCopyingEntry(null)
      setCopyWeightGrams('')
    } catch (error) {
      console.error('Error copying meal plan entry to consumption:', error)
      alert('Ошибка при копировании продукта в потребление')
    } finally {
      setCopying(false)
    }
  }

  return (
    <section className="meal-planner">
      <div className="meal-planner-head">
        <h2>Планировщик питания</h2>
        <p>Составьте постоянный план для каждого приёма пищи.</p>
      </div>

      <div className="meal-planner-selection">
        <div className={selectedMeal ? 'meal-selector expanded' : 'meal-selector'} role="group" aria-label="Приём пищи">
          {MEALS.map((meal) => (
            <button
              key={meal.type}
              type="button"
              className={selectedMeal === meal.type ? 'meal-selector-button active' : 'meal-selector-button'}
              onClick={() => selectMeal(meal.type)}
            >
              {meal.label}
            </button>
          ))}

          {selectedMeal && (
            <button
              type="button"
              className="primary meal-planner-form-toggle"
              aria-expanded={addFormOpen}
              onClick={() => {
                setAddFormOpen((open) => !open)
                setSavedProductMenuOpen(false)
              }}
            >
              Добавить продукт в план: {selectedMealLabel}
            </button>
          )}

          {selectedMeal && addFormOpen && (
            <form className="food-form meal-planner-form" onSubmit={(event) => { event.preventDefault(); void handleAddProduct() }}>
            <h3>Добавить продукт в план: {selectedMealLabel}</h3>
            <div className="meal-planner-product-details">
              <fieldset className="nutrition-block">
                <legend>Название продукта</legend>
                <div className="product-name-row">
                  <input
                    id="planner-product-name"
                    type="text"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
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
                            <button type="button" className="saved-products-back" onClick={() => setSavedProductGroup('')}>← Все категории</button>
                            <p className="saved-product-category-title">{savedProductGroup === 'favorites' ? 'Избранное' : savedProductGroup}</p>
                            <div className="saved-product-options">
                              {groupedSavedProducts.length ? groupedSavedProducts.map((product) => (
                                <button key={product.id} type="button" className="saved-product-option" onClick={() => selectSavedProduct(product.id)}>
                                  <span>{product.name}</span>
                                  <span>{product.calories_per_100g} ккал · Б {product.proteins_per_100g} · Ж {product.fats_per_100g} · У {product.carbohydrates_per_100g}</span>
                                </button>
                              )) : <p className="saved-products-empty">В этой категории нет продуктов</p>}
                            </div>
                          </>
                        ) : (
                          <>
                            <button type="button" className="saved-product-category" onClick={() => setSavedProductGroup('favorites')}>Избранное</button>
                            {PRODUCT_CATEGORIES.map((category) => (
                              <button key={category} type="button" className="saved-product-category" onClick={() => setSavedProductGroup(category)}>{category}</button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
              <fieldset className="nutrition-block">
                <legend>КБЖУ на 100 г</legend>
                <div className="nutrition-inputs nutrition-inputs-four">
                  <PlannerNumberInput id="planner-calories" label="Ккал" value={caloriesPer100g} onChange={setCaloriesPer100g} disabled={submitting} />
                  <PlannerNumberInput id="planner-proteins" label="Белки" value={proteinsPer100g} onChange={setProteinsPer100g} disabled={submitting} />
                  <PlannerNumberInput id="planner-fats" label="Жиры" value={fatsPer100g} onChange={setFatsPer100g} disabled={submitting} />
                  <PlannerNumberInput id="planner-carbohydrates" label="Углеводы" value={carbohydratesPer100g} onChange={setCarbohydratesPer100g} disabled={submitting} />
                </div>
              </fieldset>
            </div>
            <div className="form-group product-category-group">
              <label htmlFor="planner-category">Категория для «Моих продуктов»</label>
              <select id="planner-category" value={productCategory} onChange={(event) => setProductCategory(event.target.value as ProductCategory)} disabled={submitting}>
                {PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="add-button">{submitting ? 'Сохранение...' : 'Добавить'}</button>
            </form>
          )}
        </div>
      </div>

      {!selectedMeal ? (
        <p className="empty">Выберите приём пищи, чтобы добавить продукты в план.</p>
      ) : (
        <>
          <div className="food-list">
            <h3>План: {selectedMealLabel}</h3>
            {selectedMealEntries.length === 0 ? <p className="empty">Продукты не добавлены</p> : (
              <ul>
                {selectedMealEntries.map((entry) => (
                    <li key={entry.id} className="food-item">
                      <div className="food-details">
                        <div className="food-name">{entry.product_name}</div>
                        <div className="food-info">
                          <span>{entry.calories_per_100g} ккал/100г</span><span>•</span>
                          <span>Б {entry.proteins_per_100g} г</span><span>•</span>
                          <span>Ж {entry.fats_per_100g} г</span><span>•</span>
                          <span>У {entry.carbohydrates_per_100g} г</span>
                        </div>
                      </div>
                      <div className="food-actions">
                        <button type="button" className="copy-button" onClick={() => { setCopyingEntry(entry); setCopyWeightGrams('') }} title="Копировать в потребление" aria-label={`Копировать ${entry.product_name} в потребление`}>↪</button>
                        <button type="button" className="delete-button" onClick={() => void handleDeleteProduct(entry.id, entry.product_name)} title="Удалить">×</button>
                      </div>
                    </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {copyingEntry && (
        <div className="modal-overlay" role="presentation" onClick={() => !copying && setCopyingEntry(null)}>
          <form className="modal-content" role="dialog" aria-modal="true" aria-labelledby="copy-meal-plan-entry-title" onSubmit={(event) => { event.preventDefault(); void copyToConsumption() }} onClick={(event) => event.stopPropagation()}>
            <h3 id="copy-meal-plan-entry-title">Добавить в потребление</h3>
            <div className="form-group">
              <label htmlFor="copy-planner-product-name">Название продукта</label>
              <input id="copy-planner-product-name" type="text" value={copyingEntry.product_name} disabled />
            </div>
            <PlannerNumberInput id="copy-planner-weight" label="Вес, г" value={copyWeightGrams} onChange={setCopyWeightGrams} disabled={copying} />
            <div className="modal-actions">
              <button type="submit" className="save-button" disabled={copying}>{copying ? 'Добавление...' : 'Добавить'}</button>
              <button type="button" className="cancel-button" onClick={() => setCopyingEntry(null)} disabled={copying}>Отмена</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function PlannerNumberInput({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" disabled={disabled} step="0.1" min="0" inputMode="decimal" />
    </div>
  )
}
