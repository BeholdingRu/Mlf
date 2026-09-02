import { useState } from 'react'
import { useData } from '../context/DataContext'
import type { SavedProduct } from '../lib/types'

export function ProductsView() {
  const { savedProducts, addSavedProduct, updateSavedProduct, deleteSavedProduct } = useData()
  const [name, setName] = useState('')
  const [caloriesPer100g, setCaloriesPer100g] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // Состояние для редактирования
  const [editingProduct, setEditingProduct] = useState<SavedProduct | null>(null)
  const [editName, setEditName] = useState('')
  const [editCalories, setEditCalories] = useState('')

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

  const handleDeleteProduct = async (id: string, productName: string) => {
    const confirmed = window.confirm(`Вы уверены, что хотите удалить продукт "${productName}"?`)
    if (!confirmed) return

    try {
      await deleteSavedProduct(id)
    } catch (err) {
      console.error('Error deleting saved product:', err)
      alert('Не удалось удалить продукт')
    }
  }

  const handleEditClick = (product: SavedProduct) => {
    setEditingProduct(product)
    setEditName(product.name)
    setEditCalories(String(product.calories_per_100g))
  }

  const handleEditCancel = () => {
    setEditingProduct(null)
    setEditName('')
    setEditCalories('')
  }

  const handleEditSave = async () => {
    if (!editingProduct) return

    const calories = Number(editCalories)
    if (!editName.trim() || !Number.isFinite(calories) || calories <= 0) {
      alert('Укажите название и калорийность больше нуля')
      return
    }

    setSubmitting(true)
    try {
      await updateSavedProduct(editingProduct.id, editName.trim(), calories)
      handleEditCancel()
    } catch (err) {
      console.error('Error updating saved product:', err)
      alert('Не удалось обновить продукт')
    } finally {
      setSubmitting(false)
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
                <div className="food-actions">
                  <button
                    type="button"
                    className="edit-button"
                    onClick={() => handleEditClick(product)}
                    title="Редактировать продукт"
                    aria-label={`Редактировать ${product.name}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => handleDeleteProduct(product.id, product.name)}
                    title="Удалить продукт"
                    aria-label={`Удалить ${product.name}`}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Модальное окно редактирования */}
      {editingProduct && (
        <div className="modal-overlay" onClick={handleEditCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Редактировать продукт</h3>
            <div className="form-group">
              <label htmlFor="edit-product-name">Название продукта</label>
              <input
                id="edit-product-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-product-calories">Калорийность на 100г</label>
              <input
                id="edit-product-calories"
                type="number"
                value={editCalories}
                onChange={(e) => setEditCalories(e.target.value)}
                disabled={submitting}
                step="0.1"
                min="0"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={handleEditSave}
                disabled={submitting}
                className="save-button"
              >
                {submitting ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={handleEditCancel}
                disabled={submitting}
                className="cancel-button"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
