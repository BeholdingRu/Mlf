import { useEffect, useState } from 'react'
import { useData } from '../context/DataContext'
import {
  DEFAULT_PRODUCT_CATEGORY,
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from '../lib/product-categories'
import type { SavedProduct } from '../lib/types'

const PRODUCT_ADD_DRAFT_STORAGE_KEY = 'mlf:product-add-draft'
const PRODUCT_EDIT_DRAFT_STORAGE_KEY = 'mlf:product-edit-draft'

type ProductAddDraft = {
  name: string
  calories: string
  proteins: string
  fats: string
  carbohydrates: string
  category: ProductCategory
  isFavorite: boolean
}

type ProductEditDraft = {
  product: SavedProduct
  name: string
  calories: string
  proteins: string
  fats: string
  carbohydrates: string
  category: ProductCategory
}

function getSavedProductAddDraft(): ProductAddDraft | null {
  try {
    const savedDraft = window.sessionStorage.getItem(PRODUCT_ADD_DRAFT_STORAGE_KEY)
    if (!savedDraft) return null

    const draft = JSON.parse(savedDraft) as Partial<ProductAddDraft>
    if (
      typeof draft.name !== 'string'
      || typeof draft.calories !== 'string'
      || typeof draft.proteins !== 'string'
      || typeof draft.fats !== 'string'
      || typeof draft.carbohydrates !== 'string'
      || !PRODUCT_CATEGORIES.includes(draft.category as ProductCategory)
      || typeof draft.isFavorite !== 'boolean'
    ) {
      window.sessionStorage.removeItem(PRODUCT_ADD_DRAFT_STORAGE_KEY)
      return null
    }

    return {
      name: draft.name,
      calories: draft.calories,
      proteins: draft.proteins,
      fats: draft.fats,
      carbohydrates: draft.carbohydrates,
      category: draft.category as ProductCategory,
      isFavorite: draft.isFavorite,
    }
  } catch {
    window.sessionStorage.removeItem(PRODUCT_ADD_DRAFT_STORAGE_KEY)
    return null
  }
}

function getSavedProductEditDraft(): ProductEditDraft | null {
  try {
    const savedDraft = window.sessionStorage.getItem(PRODUCT_EDIT_DRAFT_STORAGE_KEY)
    if (!savedDraft) return null

    const draft = JSON.parse(savedDraft) as ProductEditDraft
    if (!draft.product?.id || !PRODUCT_CATEGORIES.includes(draft.category)) return null
    return draft
  } catch {
    window.sessionStorage.removeItem(PRODUCT_EDIT_DRAFT_STORAGE_KEY)
    return null
  }
}

function getProductCountLabel(count: number): string {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'продуктов'
  if (lastDigit === 1) return 'продукт'
  if (lastDigit >= 2 && lastDigit <= 4) return 'продукта'
  return 'продуктов'
}

export function ProductsView() {
  const { savedProducts, addSavedProduct, updateSavedProduct, setSavedProductFavorite, deleteSavedProduct } = useData()
  const [addDraft] = useState<ProductAddDraft | null>(getSavedProductAddDraft)
  const [editDraft] = useState<ProductEditDraft | null>(getSavedProductEditDraft)
  const [name, setName] = useState(addDraft?.name ?? '')
  const [caloriesPer100g, setCaloriesPer100g] = useState(addDraft?.calories ?? '')
  const [proteinsPer100g, setProteinsPer100g] = useState(addDraft?.proteins ?? '')
  const [fatsPer100g, setFatsPer100g] = useState(addDraft?.fats ?? '')
  const [carbohydratesPer100g, setCarbohydratesPer100g] = useState(addDraft?.carbohydrates ?? '')
  const [category, setCategory] = useState<ProductCategory>(addDraft?.category ?? DEFAULT_PRODUCT_CATEGORY)
  const [isFavorite, setIsFavorite] = useState(addDraft?.isFavorite ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [openCategory, setOpenCategory] = useState<ProductCategory | null>(null)
  const [editingProduct, setEditingProduct] = useState<SavedProduct | null>(editDraft?.product ?? null)
  const [editName, setEditName] = useState(editDraft?.name ?? '')
  const [editCalories, setEditCalories] = useState(editDraft?.calories ?? '')
  const [editProteins, setEditProteins] = useState(editDraft?.proteins ?? '')
  const [editFats, setEditFats] = useState(editDraft?.fats ?? '')
  const [editCarbohydrates, setEditCarbohydrates] = useState(editDraft?.carbohydrates ?? '')
  const [editCategory, setEditCategory] = useState<ProductCategory>(editDraft?.category ?? DEFAULT_PRODUCT_CATEGORY)
  const [favoriteProductId, setFavoriteProductId] = useState<string | null>(null)

  useEffect(() => {
    const isEmpty = !name && !caloriesPer100g && !proteinsPer100g && !fatsPer100g
      && !carbohydratesPer100g && category === DEFAULT_PRODUCT_CATEGORY && !isFavorite
    if (isEmpty) {
      window.sessionStorage.removeItem(PRODUCT_ADD_DRAFT_STORAGE_KEY)
      return
    }

    const draft: ProductAddDraft = {
      name,
      calories: caloriesPer100g,
      proteins: proteinsPer100g,
      fats: fatsPer100g,
      carbohydrates: carbohydratesPer100g,
      category,
      isFavorite,
    }
    window.sessionStorage.setItem(PRODUCT_ADD_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [caloriesPer100g, carbohydratesPer100g, category, fatsPer100g, isFavorite, name, proteinsPer100g])

  useEffect(() => {
    if (!editingProduct) return

    const draft: ProductEditDraft = {
      product: editingProduct,
      name: editName,
      calories: editCalories,
      proteins: editProteins,
      fats: editFats,
      carbohydrates: editCarbohydrates,
      category: editCategory,
    }
    window.sessionStorage.setItem(PRODUCT_EDIT_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [editCalories, editCarbohydrates, editCategory, editFats, editName, editProteins, editingProduct])

  const handleAddProduct = async () => {
    const calories = Number(caloriesPer100g)
    const proteins = Number(proteinsPer100g)
    const fats = Number(fatsPer100g)
    const carbohydrates = Number(carbohydratesPer100g)
    if (!name.trim() || !Number.isFinite(calories) || calories <= 0
      || !Number.isFinite(proteins) || proteins < 0
      || !Number.isFinite(fats) || fats < 0
      || !Number.isFinite(carbohydrates) || carbohydrates < 0) {
      alert('Укажите название, калорийность больше нуля и БЖУ не меньше нуля')
      return
    }

    setSubmitting(true)
    try {
      await addSavedProduct(name.trim(), calories, proteins, fats, carbohydrates, category, isFavorite)
      window.sessionStorage.removeItem(PRODUCT_ADD_DRAFT_STORAGE_KEY)
      setName('')
      setCaloriesPer100g('')
      setProteinsPer100g('')
      setFatsPer100g('')
      setCarbohydratesPer100g('')
      setCategory(DEFAULT_PRODUCT_CATEGORY)
      setIsFavorite(false)
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
    setEditProteins(String(product.proteins_per_100g))
    setEditFats(String(product.fats_per_100g))
    setEditCarbohydrates(String(product.carbohydrates_per_100g))
    setEditCategory(product.category)
  }

  const handleEditCancel = () => {
    window.sessionStorage.removeItem(PRODUCT_EDIT_DRAFT_STORAGE_KEY)
    setEditingProduct(null)
    setEditName('')
    setEditCalories('')
    setEditProteins('')
    setEditFats('')
    setEditCarbohydrates('')
    setEditCategory(DEFAULT_PRODUCT_CATEGORY)
  }

  const handleEditSave = async () => {
    if (!editingProduct) return

    const calories = Number(editCalories)
    const proteins = Number(editProteins)
    const fats = Number(editFats)
    const carbohydrates = Number(editCarbohydrates)
    if (!editName.trim() || !Number.isFinite(calories) || calories <= 0
      || !Number.isFinite(proteins) || proteins < 0
      || !Number.isFinite(fats) || fats < 0
      || !Number.isFinite(carbohydrates) || carbohydrates < 0) {
      alert('Укажите название, калорийность больше нуля и БЖУ не меньше нуля')
      return
    }

    setSubmitting(true)
    try {
      await updateSavedProduct(
        editingProduct.id,
        editName.trim(),
        calories,
        proteins,
        fats,
        carbohydrates,
        editCategory,
        editingProduct.is_favorite,
      )
      handleEditCancel()
    } catch (err) {
      console.error('Error updating saved product:', err)
      alert('Не удалось обновить продукт')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFavoriteChange = async (product: SavedProduct, isFavorite: boolean) => {
    setFavoriteProductId(product.id)
    try {
      await setSavedProductFavorite(product.id, isFavorite)
    } catch (err) {
      console.error('Error updating saved product favorite:', err)
      alert('Не удалось изменить статус избранного')
    } finally {
      setFavoriteProductId(null)
    }
  }

  const productsByCategory = PRODUCT_CATEGORIES.map((productCategory) => ({
    category: productCategory,
    products: savedProducts.filter((product) => product.category === productCategory),
  }))

  return (
    <section className="products-view">
      <div className="food-form">
        <h3>Добавьте продукт</h3>
        <fieldset className="nutrition-block">
          <legend>Название продукта</legend>
          <input
            id="saved-product-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, гречка"
            disabled={submitting}
          />
        </fieldset>
        <fieldset className="nutrition-block">
          <legend>КБЖУ на 100 г</legend>
          <div className="nutrition-inputs nutrition-inputs-four">
            <div className="form-group">
              <label htmlFor="saved-product-calories">Ккал</label>
              <input id="saved-product-calories" type="number" value={caloriesPer100g} onChange={(e) => setCaloriesPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
            </div>
            <div className="form-group">
              <label htmlFor="saved-product-proteins">Белки</label>
              <input id="saved-product-proteins" type="number" value={proteinsPer100g} onChange={(e) => setProteinsPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
            </div>
            <div className="form-group">
              <label htmlFor="saved-product-fats">Жиры</label>
              <input id="saved-product-fats" type="number" value={fatsPer100g} onChange={(e) => setFatsPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
            </div>
            <div className="form-group">
              <label htmlFor="saved-product-carbohydrates">Углеводы</label>
              <input id="saved-product-carbohydrates" type="number" value={carbohydratesPer100g} onChange={(e) => setCarbohydratesPer100g(e.target.value)} placeholder="0" disabled={submitting} step="0.1" min="0" inputMode="decimal" />
            </div>
          </div>
        </fieldset>
        <div className="form-group product-category-group">
          <label htmlFor="saved-product-category">Категория</label>
          <select
            id="saved-product-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            disabled={submitting}
          >
            {PRODUCT_CATEGORIES.map((productCategory) => (
              <option key={productCategory} value={productCategory}>
                {productCategory}
              </option>
            ))}
          </select>
        </div>
        <label className="product-favorite-toggle">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            disabled={submitting}
          />
          Избранное
        </label>
        <button type="button" onClick={handleAddProduct} disabled={submitting} className="add-button">
          {submitting ? 'Сохранение...' : 'Добавить продукт'}
        </button>
      </div>

      <div className="food-list">
        <h3>Мои продукты</h3>
        {savedProducts.length === 0 ? (
          <p className="empty">Сохранённых продуктов пока нет</p>
        ) : (
          <div className="product-categories">
            {productsByCategory.map(({ category: productCategory, products }) => (
              <section key={productCategory} className="product-category">
                <button
                  type="button"
                  className="product-category-toggle"
                  aria-expanded={openCategory === productCategory}
                  aria-controls={`product-category-${PRODUCT_CATEGORIES.indexOf(productCategory)}`}
                  onClick={() => setOpenCategory((current) => current === productCategory ? null : productCategory)}
                >
                  <span>{productCategory}</span>
                  <span>
                    {products.length} {getProductCountLabel(products.length)} ·{' '}
                    {openCategory === productCategory ? '−' : '+'}
                  </span>
                </button>
                {openCategory === productCategory && (
                  <ul id={`product-category-${PRODUCT_CATEGORIES.indexOf(productCategory)}`}>
                    {products.length === 0 ? (
                      <li className="product-category-empty">В этой категории пока нет продуктов</li>
                    ) : products.map((product) => (
                      <li key={product.id} className="food-item">
                        <div className="food-details">
                          <div className="food-name">
                            {product.name}{product.is_favorite && <span className="favorite-mark" aria-label="Избранное"> ★</span>}
                          </div>
                          <div className="food-info">
                            {product.calories_per_100g} ккал/100г · Б {product.proteins_per_100g} г · Ж {product.fats_per_100g} г · У {product.carbohydrates_per_100g} г
                          </div>
                        </div>
                        <div className="food-actions">
                          <label className="favorite-control" title="Избранное">
                            <input
                              type="checkbox"
                              checked={product.is_favorite}
                              disabled={favoriteProductId === product.id}
                              onChange={(e) => handleFavoriteChange(product, e.target.checked)}
                              aria-label={`Добавить ${product.name} в избранное`}
                            />
                            <span aria-hidden="true">★</span>
                          </label>
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
              </section>
            ))}
          </div>
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
              <label htmlFor="edit-product-category">Категория</label>
              <select
                id="edit-product-category"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as ProductCategory)}
                disabled={submitting}
              >
                {PRODUCT_CATEGORIES.map((productCategory) => (
                  <option key={productCategory} value={productCategory}>
                    {productCategory}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="nutrition-block">
              <legend>КБЖУ на 100 г</legend>
              <div className="nutrition-inputs nutrition-inputs-four">
                <div className="form-group">
                  <label htmlFor="edit-product-calories">Ккал</label>
                  <input id="edit-product-calories" type="number" value={editCalories} onChange={(e) => setEditCalories(e.target.value)} disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-product-proteins">Белки</label>
                  <input id="edit-product-proteins" type="number" value={editProteins} onChange={(e) => setEditProteins(e.target.value)} disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-product-fats">Жиры</label>
                  <input id="edit-product-fats" type="number" value={editFats} onChange={(e) => setEditFats(e.target.value)} disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-product-carbohydrates">Углеводы</label>
                  <input id="edit-product-carbohydrates" type="number" value={editCarbohydrates} onChange={(e) => setEditCarbohydrates(e.target.value)} disabled={submitting} step="0.1" min="0" inputMode="decimal" />
                </div>
              </div>
            </fieldset>
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
