import { useState } from 'react'
import { useData } from '../context/DataContext'

export function ProductsView() {
  const { savedProducts, addSavedProduct, deleteSavedProduct } = useData()
  const [name, setName] = useState('')
  const [caloriesPer100g, setCaloriesPer100g] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAddProduct = async () => {
    const calories = Number(caloriesPer100g)
    if (!name.trim() || !Number.isFinite(calories) || calories <= 0) {
      alert('Укажите название и калорийность больше нуля')
      return
    }

    setSubmitting(true)
    try {
      await addSavedProduct(name.trim(), calories)
      setName('')
      setCaloriesPer100g('')
    } catch (err) {
      console.error('Error adding saved product:', err)
      alert('Не удалось сохранить продукт. Возможно, он уже есть в списке.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteSavedProduct(id)
    } catch (err) {
      console.error('Error deleting saved product:', err)
      alert('Не удалось удалить продукт')
    }
  }

  return (
    <section className="products-view">
      <div className="food-form">
        <h3>Добавьте продукт</h3>
        <div className="form-group">
          <label htmlFor="saved-product-name">Название продукта</label>
          <input
            id="saved-product-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, гречка"
            disabled={submitting}
          />
        </div>
        <div className="form-group">
          <label htmlFor="saved-product-calories">Калорийность на 100г</label>
          <input
            id="saved-product-calories"
            type="number"
            value={caloriesPer100g}
            onChange={(e) => setCaloriesPer100g(e.target.value)}
            placeholder="0"
            disabled={submitting}
            step="0.1"
            min="0"
          />
        </div>
        <button type="button" onClick={handleAddProduct} disabled={submitting} className="add-button">
          {submitting ? 'Сохранение...' : 'Добавить продукт'}
        </button>
      </div>

      <div className="food-list">
        <h3>Мои продукты</h3>
        {savedProducts.length === 0 ? (
          <p className="empty">Сохранённых продуктов пока нет</p>
        ) : (
          <ul>
            {savedProducts.map((product) => (
              <li key={product.id} className="food-item">
                <div className="food-details">
                  <div className="food-name">{product.name}</div>
                  <div className="food-info">{product.calories_per_100g} ккал/100г</div>
                </div>
                <button
                  type="button"
                  className="delete-button"
                  onClick={() => handleDeleteProduct(product.id)}
                  title="Удалить продукт"
                  aria-label={`Удалить ${product.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
