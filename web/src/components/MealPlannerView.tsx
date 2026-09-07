import { useState } from 'react'
import { useData } from '../hooks/useData'
import { localISODate, parseISODate } from '../lib/dates'
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES, type ProductCategory } from '../lib/product-categories'
import type { MealPlanEntry, MealType } from '../lib/types'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Завтрак' },
  { type: 'lunch', label: 'Обед' },
  { type: 'dinner', label: 'Ужин' },
]

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function MealPlannerView() {
  const { mealPlanEntries, savedProducts, addSavedProduct, addMealPlanEntry, updateMealPlanEntry, deleteMealPlanEntry } = useData()
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null)
  const [selectedDate, setSelectedDate] = useState(localISODate)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [productName, setProductName] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
  const [caloriesPer100g, setCaloriesPer100g] = useState('')
  const [proteinsPer100g, setProteinsPer100g] = useState('')
  const [fatsPer100g, setFatsPer100g] = useState('')
  const [carbohydratesPer100g, setCarbohydratesPer100g] = useState('')
  const [productCategory, setProductCategory] = useState<ProductCategory>(DEFAULT_PRODUCT_CATEGORY)
  const [savedProductGroup, setSavedProductGroup] = useState<ProductCategory | 'favorites' | ''>('')
  const [savedProductMenuOpen, setSavedProductMenuOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null)
  const [editWeightGrams, setEditWeightGrams] = useState('')

  const selectedMealLabel = MEALS.find((meal) => meal.type === selectedMeal)?.label
  const selectedMealEntries = mealPlanEntries.filter(
    (entry) => entry.planned_on === selectedDate && entry.meal_type === selectedMeal,
  )
  const mealNutrition = MEALS.reduce((totals, meal) => {
    totals[meal.type] = mealPlanEntries
      .filter((entry) => entry.planned_on === selectedDate && entry.meal_type === meal.type)
      .reduce((nutrition, entry) => {
        const multiplier = entry.weight_grams / 100
        nutrition.calories += multiplier * entry.calories_per_100g
        nutrition.proteins += multiplier * entry.proteins_per_100g
        nutrition.fats += multiplier * entry.fats_per_100g
        nutrition.carbohydrates += multiplier * entry.carbohydrates_per_100g
        return nutrition
      }, { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 })
    return totals
  }, {} as Record<MealType, { calories: number; proteins: number; fats: number; carbohydrates: number }>)
  const plannedDates = new Set(mealPlanEntries.map((entry) => entry.planned_on))
  const groupedSavedProducts = savedProductGroup === 'favorites'
    ? savedProducts.filter((product) => product.is_favorite)
    : savedProducts.filter((product) => product.category === savedProductGroup)

  function selectMeal(mealType: MealType) {
    setSelectedMeal((currentMeal) => currentMeal === mealType ? null : mealType)
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
        await addSavedProduct(name, calories, proteins, fats, carbohydrates, productCategory, false)
      }

      await addMealPlanEntry(
        selectedDate,
        selectedMeal,
        name,
        parseFloat(weightGrams),
        calories,
        proteins,
        fats,
        carbohydrates,
      )
      setProductName('')
      setWeightGrams('')
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
    if (!window.confirm(`Удалить «${name}» из плана «${selectedMealLabel}» на ${selectedDate}?`)) return

    try {
      await deleteMealPlanEntry(id)
    } catch (error) {
      console.error('Error deleting meal plan entry:', error)
      alert('Ошибка при удалении продукта')
    }
  }

  function startEditingEntry(entry: MealPlanEntry) {
    setEditingEntry(entry)
    setEditWeightGrams(String(entry.weight_grams))
  }

  async function handleEditProduct() {
    if (!editingEntry) return

    const weight = Number(editWeightGrams)
    if (!Number.isFinite(weight) || weight < 0) {
      alert('Введите корректный вес продукта')
      return
    }

    setSubmitting(true)
    try {
      await updateMealPlanEntry(editingEntry.id, weight)
      setEditingEntry(null)
    } catch (error) {
      console.error('Error updating meal plan entry:', error)
      alert('Ошибка при сохранении изменений')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="meal-planner">
      <div className="meal-planner-head">
        <h2>Планировщик питания</h2>
        <p>Выберите дату и составьте план для каждого приёма пищи.</p>
      </div>

      <div className="meal-planner-selection">
        <MealPlanCalendar
          visibleMonth={visibleMonth}
          selectedDate={selectedDate}
          plannedDates={plannedDates}
          onPreviousMonth={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
          onNextMonth={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          onSelectDate={setSelectedDate}
        />

        <div className={selectedMeal ? 'meal-selector expanded' : 'meal-selector'} role="group" aria-label="Приём пищи">
          {MEALS.filter((meal) => !selectedMeal || meal.type === selectedMeal).map((meal) => (
            <button
              key={meal.type}
              type="button"
              className={selectedMeal === meal.type ? 'meal-selector-button active' : 'meal-selector-button'}
              onClick={() => selectMeal(meal.type)}
            >
              <span>{meal.label}</span>
              <span className="meal-selector-nutrition">
                {formatNutrition(mealNutrition[meal.type])}
              </span>
            </button>
          ))}

          {selectedMeal && (
            <form className="food-form meal-planner-form" onSubmit={(event) => { event.preventDefault(); void handleAddProduct() }}>
            <h3>Добавить продукт в план: {selectedMealLabel}, {formatDate(selectedDate)}</h3>
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
            <fieldset className="nutrition-block">
              <legend>Вес продукта</legend>
              <PlannerNumberInput id="planner-weight" label="Граммы" value={weightGrams} onChange={setWeightGrams} disabled={submitting} />
            </fieldset>
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
            <h3>План: {selectedMealLabel}, {formatDate(selectedDate)}</h3>
            {selectedMealEntries.length === 0 ? <p className="empty">Продукты не добавлены</p> : (
              <ul>
                {selectedMealEntries.map((entry) => {
                  const multiplier = entry.weight_grams / 100
                  return (
                    <li key={entry.id} className="food-item">
                      <div className="food-details">
                        <div className="food-name">{entry.product_name}</div>
                        <div className="food-info">
                          <span>{entry.weight_grams}г</span><span>•</span><span>{entry.calories_per_100g} ккал/100г</span><span>•</span>
                          <span>Б {(multiplier * entry.proteins_per_100g).toFixed(1)} г</span><span>•</span>
                          <span>Ж {(multiplier * entry.fats_per_100g).toFixed(1)} г</span><span>•</span>
                          <span>У {(multiplier * entry.carbohydrates_per_100g).toFixed(1)} г</span><span>•</span>
                          <span className="consumed">{(multiplier * entry.calories_per_100g).toFixed(0)} ккал</span>
                        </div>
                      </div>
                      <div className="food-actions">
                        <button type="button" className="edit-button" onClick={() => startEditingEntry(entry)} title="Редактировать" aria-label={`Редактировать ${entry.product_name}`}>✎</button>
                        <button type="button" className="delete-button" onClick={() => void handleDeleteProduct(entry.id, entry.product_name)} title="Удалить">×</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
      {editingEntry && (
        <div className="modal-overlay" role="presentation" onClick={() => !submitting && setEditingEntry(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="edit-meal-plan-entry-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="edit-meal-plan-entry-title">Редактировать продукт</h3>
            <div className="form-group">
              <label htmlFor="edit-planner-product-name">Название продукта</label>
              <input id="edit-planner-product-name" type="text" value={editingEntry.product_name} disabled />
            </div>
            <fieldset className="nutrition-block">
              <legend>КБЖУ на 100 г</legend>
              <div className="nutrition-inputs nutrition-inputs-four">
                <PlannerNumberInput id="edit-planner-calories" label="Ккал" value={String(editingEntry.calories_per_100g)} onChange={() => {}} disabled />
                <PlannerNumberInput id="edit-planner-proteins" label="Белки" value={String(editingEntry.proteins_per_100g)} onChange={() => {}} disabled />
                <PlannerNumberInput id="edit-planner-fats" label="Жиры" value={String(editingEntry.fats_per_100g)} onChange={() => {}} disabled />
                <PlannerNumberInput id="edit-planner-carbohydrates" label="Углеводы" value={String(editingEntry.carbohydrates_per_100g)} onChange={() => {}} disabled />
              </div>
            </fieldset>
            <PlannerNumberInput id="edit-planner-weight" label="Вес, г" value={editWeightGrams} onChange={setEditWeightGrams} disabled={submitting} />
            <div className="modal-actions">
              <button type="button" className="save-button" onClick={() => void handleEditProduct()} disabled={submitting}>{submitting ? 'Сохранение...' : 'Сохранить'}</button>
              <button type="button" className="cancel-button" onClick={() => setEditingEntry(null)} disabled={submitting}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function MealPlanCalendar({ visibleMonth, selectedDate, plannedDates, onPreviousMonth, onNextMonth, onSelectDate }: {
  visibleMonth: Date
  selectedDate: string
  plannedDates: Set<string>
  onPreviousMonth: () => void
  onNextMonth: () => void
  onSelectDate: (date: string) => void
}) {
  const firstWeekday = (visibleMonth.getDay() + 6) % 7
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const today = localISODate()

  return (
    <section className="meal-plan-calendar" aria-label="Календарь планировщика">
      <div className="calendar-head">
        <button type="button" className="calendar-nav" onClick={onPreviousMonth} aria-label="Предыдущий месяц">←</button>
        <h2>{MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</h2>
        <button type="button" className="calendar-nav" onClick={onNextMonth} aria-label="Следующий месяц">→</button>
      </div>
      <div className="calendar-grid" role="grid" aria-label="Выбор даты плана">
        {WEEKDAYS.map((weekday) => <span key={weekday} className="calendar-weekday">{weekday}</span>)}
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const iso = localISODate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
          const classes = [
            'calendar-day',
            plannedDates.has(iso) ? 'has-plan' : '',
            selectedDate === iso ? 'selected' : '',
            today === iso ? 'today' : '',
          ].filter(Boolean).join(' ')
          return <button key={iso} type="button" className={classes} onClick={() => onSelectDate(iso)}>{day}</button>
        })}
      </div>
      <p className="calendar-hint">Выбрано: {formatDate(selectedDate)}. Зелёные дни содержат план питания.</p>
    </section>
  )
}

function formatDate(iso: string) {
  return parseISODate(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatNutrition(nutrition: { calories: number; proteins: number; fats: number; carbohydrates: number }) {
  return `${nutrition.calories.toFixed(0)} ккал · Б ${nutrition.proteins.toFixed(1)} · Ж ${nutrition.fats.toFixed(1)} · У ${nutrition.carbohydrates.toFixed(1)}`
}

function PlannerNumberInput({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" disabled={disabled} step="0.1" min="0" inputMode="decimal" />
    </div>
  )
}
