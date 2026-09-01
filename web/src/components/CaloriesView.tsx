import { useState } from 'react'
import { useData } from '../context/DataContext'
import { ProductsView } from './ProductsView'

export function CaloriesView() {
  const { profile, foodLogs, savedProducts, logFoodToday, deleteFoodLog } = useData()
  const [productName, setProductName] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
  const [caloriesPer100g, setCaloriesPer100g] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const dailyNorm = profile?.daily_calories_norm ?? 0

  const totalConsumed = foodLogs.reduce((sum, food) => {
    const consumed = (food.weight_grams / 100) * food.calories_per_100g
    return sum + consumed
  }, 0)

  const remaining = dailyNorm - totalConsumed

  const handleAddFood = async () => {
    if (!productName.trim() || !weightGrams || !caloriesPer100g) {
      alert('Пожалуйста, заполните все поля')
      return
    }

    setSubmitting(true)
    try {
      await logFoodToday(
        productName.trim(),
        parseFloat(weightGrams),
        parseFloat(caloriesPer100g),
      )
      setProductName('')
      setWeightGrams('')
      setCaloriesPer100g('')
    } catch (err) {
      console.error('Error logging food:', err)
      alert('Ошибка при сохранении продукта')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteFood = async (id: string) => {
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
  }

  return (
    <div className="calories-view">
      <div className="calories-header">
        <div className="calories-info">
          <div className="info-item">
            <span className="label">Дневная норма калорий:</span>
            <span className="value">{dailyNorm.toFixed(0)}</span>
          </div>
          <div className="info-item">
            <span className="label">Потреблено:</span>
            <span className="value">{totalConsumed.toFixed(0)}</span>
          </div>
          <div className="info-item">
            <span className={`label remaining ${remaining >= 0 ? 'positive' : 'negative'}`}>
              Осталось калорий:
            </span>
            <span className={`value ${remaining >= 0 ? 'positive' : 'negative'}`}>
              {remaining.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      <div className="food-form">
        <h3>Добавить продукт</h3>
        <div className="form-group">
          <label htmlFor="product-name">Название продукта</label>
          <div className="product-name-row">
            <input
              id="product-name"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Введите название продукта"
              disabled={submitting}
            />
            <select
              aria-label="Выбрать сохранённый продукт"
              defaultValue=""
              disabled={submitting || savedProducts.length === 0}
              onChange={(e) => {
                selectSavedProduct(e.target.value)
                e.currentTarget.value = ''
              }}
            >
              <option value="">{savedProducts.length ? 'Из продуктов' : 'Нет продуктов'}</option>
              {savedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {product.calories_per_100g} ккал
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="weight">Вес (гр)</label>
          <input
            id="weight"
            type="number"
            value={weightGrams}
            onChange={(e) => setWeightGrams(e.target.value)}
            placeholder="0"
            disabled={submitting}
            step="0.1"
            min="0"
          />
        </div>
        <div className="form-group">
          <label htmlFor="calories">Калорийность на 100г</label>
          <input
            id="calories"
            type="number"
            value={caloriesPer100g}
            onChange={(e) => setCaloriesPer100g(e.target.value)}
            placeholder="0"
            disabled={submitting}
            step="0.1"
            min="0"
          />
        </div>
        <button onClick={handleAddFood} disabled={submitting} className="add-button">
          {submitting ? 'Сохранение...' : 'Добавить'}
        </button>
      </div>

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
                      <span className="consumed">{consumed.toFixed(0)} ккал</span>
                    </div>
                  </div>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteFood(food.id)}
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

      <ProductsView />
    </div>
  )
}
