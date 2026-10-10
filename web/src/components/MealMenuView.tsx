import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useData } from '../hooks/useData'
import {
  DEFAULT_PRODUCT_CATEGORY,
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from '../lib/product-categories'
import type { SavedMeal, SavedMealItem, SavedProduct } from '../lib/types'
import { localISODate } from '../lib/dates'

const MENU_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const MENU_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MENU_NAME_COLLATOR = new Intl.Collator('ru-RU', {
  sensitivity: 'base',
  numeric: true,
})

type MealProductDraft = {
  productName: string
  weightGrams: string
  caloriesPer100g: string
  proteinsPer100g: string
  fatsPer100g: string
  carbohydratesPer100g: string
  category: ProductCategory
}

type DraftMealItem = SavedMealItem & {
  draftId: string
  weightInput: string
}

type NutritionTotals = {
  weight: number
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
}

type SavedMealGroup = {
  key: string
  identifier: string | null
  meals: SavedMeal[]
}

type SavedMealGroupDraft = {
  id: string
  name: string
  items: DraftMealItem[]
}

type SavedMealGroupProductDraft = {
  productId: string
  weightInput: string
}

type ShoppingListResult = {
  from: string
  to: string
  items: Array<{
    productId: string
    name: string
    weightGrams: number
  }>
}

const EMPTY_PRODUCT_DRAFT: MealProductDraft = {
  productName: '',
  weightGrams: '',
  caloriesPer100g: '',
  proteinsPer100g: '',
  fatsPer100g: '',
  carbohydratesPer100g: '',
  category: DEFAULT_PRODUCT_CATEGORY,
}

const EMPTY_GROUP_PRODUCT_DRAFT: SavedMealGroupProductDraft = {
  productId: '',
  weightInput: '',
}

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'))
}

function formatNumber(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(value)
}

function normalizeProductName(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU')
}

function getMealGroupIdentifier(name: string): string | null {
  const match = name.match(/\(([^()]*)\)/u)
  return match && match[1].length > 0 ? match[1] : null
}

function normalizeMealGroupIdentifier(identifier: string): string {
  return identifier.toLocaleLowerCase('ru-RU')
}

function groupSavedMeals(meals: SavedMeal[]): SavedMealGroup[] {
  const identifierCounts = new Map<string, number>()
  meals.forEach((meal) => {
    const identifier = getMealGroupIdentifier(meal.name)
    if (identifier !== null) {
      const normalizedIdentifier = normalizeMealGroupIdentifier(identifier)
      identifierCounts.set(
        normalizedIdentifier,
        (identifierCounts.get(normalizedIdentifier) ?? 0) + 1,
      )
    }
  })

  const groups: SavedMealGroup[] = []
  const groupIndexes = new Map<string, number>()
  meals.forEach((meal) => {
    const identifier = getMealGroupIdentifier(meal.name)
    const normalizedIdentifier = identifier === null
      ? null
      : normalizeMealGroupIdentifier(identifier)
    if (
      identifier === null
      || normalizedIdentifier === null
      || (identifierCounts.get(normalizedIdentifier) ?? 0) < 2
    ) {
      groups.push({ key: `meal:${meal.id}`, identifier: null, meals: [meal] })
      return
    }

    const key = `group:${normalizedIdentifier}`
    const existingIndex = groupIndexes.get(key)
    if (existingIndex === undefined) {
      groupIndexes.set(key, groups.length)
      groups.push({ key, identifier, meals: [meal] })
      return
    }
    groups[existingIndex].meals.push(meal)
  })

  groups.forEach((group) => {
    group.meals.sort((left, right) => MENU_NAME_COLLATOR.compare(left.name, right.name))
  })

  return groups.sort((left, right) => {
    const leftIsGroup = left.identifier !== null
    const rightIsGroup = right.identifier !== null
    if (leftIsGroup !== rightIsGroup) return leftIsGroup ? -1 : 1

    const leftName = left.identifier ?? left.meals[0]?.name ?? ''
    const rightName = right.identifier ?? right.meals[0]?.name ?? ''
    return MENU_NAME_COLLATOR.compare(leftName, rightName)
  })
}

function MealGroupIcon() {
  return (
    <svg
      className="meal-menu-group-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10.6 13.4a4.5 4.5 0 0 0 6.4.1l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.7 1.7" />
      <path d="M13.4 10.6a4.5 4.5 0 0 0-6.4-.1l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.7-1.7" />
    </svg>
  )
}

function getItemNutrition(item: SavedMealItem, product: SavedProduct): NutritionTotals {
  const multiplier = item.weight_grams / 100
  return {
    weight: item.weight_grams,
    calories: product.calories_per_100g * multiplier,
    proteins: product.proteins_per_100g * multiplier,
    fats: product.fats_per_100g * multiplier,
    carbohydrates: product.carbohydrates_per_100g * multiplier,
  }
}

function getMealTotals(
  items: SavedMealItem[],
  productMap: ReadonlyMap<string, SavedProduct>,
): { totals: NutritionTotals; hasMissingProduct: boolean } {
  let hasMissingProduct = false
  const totals = items.reduce<NutritionTotals>((currentTotals, item) => {
    const product = productMap.get(item.saved_product_id)
    if (!product) {
      hasMissingProduct = true
      return {
        ...currentTotals,
        weight: currentTotals.weight + item.weight_grams,
      }
    }

    const nutrition = getItemNutrition(item, product)
    return {
      weight: currentTotals.weight + nutrition.weight,
      calories: currentTotals.calories + nutrition.calories,
      proteins: currentTotals.proteins + nutrition.proteins,
      fats: currentTotals.fats + nutrition.fats,
      carbohydrates: currentTotals.carbohydrates + nutrition.carbohydrates,
    }
  }, {
    weight: 0,
    calories: 0,
    proteins: 0,
    fats: 0,
    carbohydrates: 0,
  })

  return { totals, hasMissingProduct }
}

function MealNutritionInline({
  items,
  productMap,
}: {
  items: SavedMealItem[]
  productMap: ReadonlyMap<string, SavedProduct>
}) {
  const { totals, hasMissingProduct } = getMealTotals(items, productMap)

  return (
    <span className="meal-menu-inline-nutrition" aria-label="КБЖУ приёма пищи">
      {hasMissingProduct ? 'КБЖУ: —' : (
        <>
          <span>{formatNumber(totals.calories, 0)} ккал</span>
          <span>Б {formatNumber(totals.proteins)} г</span>
          <span>Ж {formatNumber(totals.fats)} г</span>
          <span>У {formatNumber(totals.carbohydrates)} г</span>
        </>
      )}
    </span>
  )
}

function MealItemsTable({
  items,
  productMap,
  onRemove,
  onWeightChange,
  editingDisabled = false,
  caption,
}: {
  items: Array<SavedMealItem | DraftMealItem>
  productMap: ReadonlyMap<string, SavedProduct>
  onRemove?: (draftId: string) => void
  onWeightChange?: (draftId: string, value: string) => void
  editingDisabled?: boolean
  caption: string
}) {
  const { totals, hasMissingProduct } = getMealTotals(items, productMap)

  return (
    <div className="meal-menu-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="meal-menu-table" aria-label={caption}>
        <thead>
          <tr>
            <th scope="col">Продукт</th>
            <th scope="col">Вес</th>
            <th scope="col">Калории</th>
            <th scope="col">Белки</th>
            <th scope="col">Жиры</th>
            <th scope="col">Углеводы</th>
            {onRemove && <th scope="col" aria-label="Действия" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const product = productMap.get(item.saved_product_id)
            const nutrition = product ? getItemNutrition(item, product) : null
            const draftId = 'draftId' in item ? item.draftId : null
            const productName = product?.name ?? 'Удалённый продукт'

            return (
              <tr key={draftId ?? `${item.saved_product_id}-${index}`}>
                <th scope="row">{productName}</th>
                <td>
                  {draftId && onWeightChange && 'weightInput' in item ? (
                    <input
                      type="number"
                      className="meal-menu-table-weight-input"
                      value={item.weightInput}
                      onChange={(event) => onWeightChange(draftId, event.target.value)}
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      disabled={editingDisabled}
                      aria-label={`Вес продукта «${productName}», г`}
                    />
                  ) : `${formatNumber(item.weight_grams)} г`}
                </td>
                <td>{nutrition ? `${formatNumber(nutrition.calories, 0)} ккал` : '—'}</td>
                <td>{nutrition ? `${formatNumber(nutrition.proteins)} г` : '—'}</td>
                <td>{nutrition ? `${formatNumber(nutrition.fats)} г` : '—'}</td>
                <td>{nutrition ? `${formatNumber(nutrition.carbohydrates)} г` : '—'}</td>
                {onRemove && (
                  <td className="meal-menu-table-action">
                    <button
                      type="button"
                      className="delete-button meal-menu-remove-product"
                      onClick={() => draftId && onRemove(draftId)}
                      disabled={editingDisabled}
                      aria-label={`Убрать ${productName} из приёма пищи`}
                      title="Убрать продукт"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="meal-menu-total-row">
            <th scope="row">Итого</th>
            <td>{formatNumber(totals.weight)} г</td>
            <td>{hasMissingProduct ? '—' : `${formatNumber(totals.calories, 0)} ккал`}</td>
            <td>{hasMissingProduct ? '—' : `${formatNumber(totals.proteins)} г`}</td>
            <td>{hasMissingProduct ? '—' : `${formatNumber(totals.fats)} г`}</td>
            <td>{hasMissingProduct ? '—' : `${formatNumber(totals.carbohydrates)} г`}</td>
            {onRemove && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function MealGroupTotals({
  meals,
  identifier,
  productMap,
}: {
  meals: SavedMeal[]
  identifier: string
  productMap: ReadonlyMap<string, SavedProduct>
}) {
  const { totals, hasMissingProduct } = getMealTotals(
    meals.flatMap((meal) => meal.items),
    productMap,
  )

  return (
    <section
      className="meal-menu-group-total"
      aria-label={`Общие КБЖУ группы (${identifier})`}
    >
      <strong>Общие КБЖУ</strong>
      <dl>
        <div>
          <dt>Калории</dt>
          <dd>{hasMissingProduct ? '—' : `${formatNumber(totals.calories, 0)} ккал`}</dd>
        </div>
        <div>
          <dt>Белки</dt>
          <dd>{hasMissingProduct ? '—' : `${formatNumber(totals.proteins)} г`}</dd>
        </div>
        <div>
          <dt>Жиры</dt>
          <dd>{hasMissingProduct ? '—' : `${formatNumber(totals.fats)} г`}</dd>
        </div>
        <div>
          <dt>Углеводы</dt>
          <dd>{hasMissingProduct ? '—' : `${formatNumber(totals.carbohydrates)} г`}</dd>
        </div>
      </dl>
    </section>
  )
}

function SavedMealCard({
  groupKey,
  meal,
  productMap,
  expanded,
  deleting,
  actionsDisabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  groupKey: string
  meal: SavedMeal
  productMap: ReadonlyMap<string, SavedProduct>
  expanded: boolean
  deleting: boolean
  actionsDisabled: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const panelId = `saved-meal-${meal.id}`
  const buttonId = `${panelId}-button`

  return (
    <article
      className={expanded ? 'meal-menu-card expanded' : 'meal-menu-card'}
      data-meal-group-key={groupKey}
    >
      <div className="meal-menu-card-head">
        <button
          id={buttonId}
          type="button"
          className="meal-menu-trigger"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          disabled={deleting}
        >
          <span className="meal-menu-trigger-main">
            <span>{meal.name}</span>
            <MealNutritionInline items={meal.items} productMap={productMap} />
          </span>
          <span className="meal-menu-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
        </button>
        <button
          type="button"
          className="edit-button meal-menu-edit-meal"
          onClick={onEdit}
          disabled={actionsDisabled}
          aria-label={`Редактировать приём пищи «${meal.name}»`}
          title="Редактировать приём пищи"
        >
          ✎
        </button>
        <button
          type="button"
          className="delete-button meal-menu-delete-meal"
          onClick={onDelete}
          disabled={actionsDisabled}
          aria-label={`Удалить приём пищи «${meal.name}»`}
          title="Удалить приём пищи"
        >
          {deleting ? '…' : '×'}
        </button>
      </div>
      {expanded && (
        <div id={panelId} className="meal-menu-details" role="region" aria-labelledby={buttonId}>
          <MealItemsTable
            items={meal.items}
            productMap={productMap}
            caption={`Продукты в приёме пищи «${meal.name}»`}
          />
        </div>
      )}
    </article>
  )
}

function SavedMealGroupCard({
  groupKey,
  identifier,
  meals,
  productMap,
  expanded,
  deletingMealId,
  actionsDisabled,
  onToggle,
  onSave,
  onDelete,
}: {
  groupKey: string
  identifier: string
  meals: SavedMeal[]
  productMap: ReadonlyMap<string, SavedProduct>
  expanded: boolean
  deletingMealId: string | null
  actionsDisabled: boolean
  onToggle: () => void
  onSave: (drafts: SavedMealGroupDraft[]) => Promise<void>
  onDelete: (meal: SavedMeal) => void
}) {
  const panelId = useId()
  const buttonId = useId()
  const addedProductCounter = useRef(0)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<SavedMealGroupDraft[]>([])
  const [productDrafts, setProductDrafts] = useState<Record<string, SavedMealGroupProductDraft>>({})
  const sortedProducts = useMemo(
    () => [...productMap.values()].sort((left, right) => (
      MENU_NAME_COLLATOR.compare(left.name, right.name)
    )),
    [productMap],
  )

  const startEditing = () => {
    setDrafts(meals.map((meal) => ({
      id: meal.id,
      name: meal.name,
      items: meal.items.map((item, index) => ({
        ...item,
        draftId: `${meal.id}-${index}`,
        weightInput: String(item.weight_grams),
      })),
    })))
    setProductDrafts(Object.fromEntries(
      meals.map((meal) => [meal.id, { ...EMPTY_GROUP_PRODUCT_DRAFT }]),
    ))
    setEditError(null)
    setEditing(true)
    if (!expanded) onToggle()
  }

  const updateGroupProductDraft = (
    mealId: string,
    field: keyof SavedMealGroupProductDraft,
    value: string,
  ) => {
    setProductDrafts((current) => ({
      ...current,
      [mealId]: {
        ...(current[mealId] ?? EMPTY_GROUP_PRODUCT_DRAFT),
        [field]: value,
      },
    }))
    setEditError(null)
  }

  const addProductToMeal = (mealId: string) => {
    const productDraft = productDrafts[mealId] ?? EMPTY_GROUP_PRODUCT_DRAFT
    const product = productMap.get(productDraft.productId)
    if (!product) {
      setEditError('Выберите продукт для добавления')
      return
    }

    const weight = parseNumber(productDraft.weightInput)
    if (!productDraft.weightInput.trim() || !Number.isFinite(weight) || weight <= 0) {
      setEditError('Укажите вес добавляемого продукта больше нуля')
      return
    }

    const mealDraft = drafts.find((draft) => draft.id === mealId)
    if (!mealDraft) return
    if (mealDraft.items.length >= 100) {
      setEditError('В один приём пищи можно добавить не более 100 продуктов')
      return
    }

    addedProductCounter.current += 1
    setDrafts((current) => current.map((draft) => draft.id === mealId
      ? {
          ...draft,
          items: [...draft.items, {
            draftId: `${mealId}-added-${addedProductCounter.current}`,
            saved_product_id: product.id,
            weight_grams: weight,
            weightInput: String(weight),
          }],
        }
      : draft))
    setProductDrafts((current) => ({
      ...current,
      [mealId]: { ...EMPTY_GROUP_PRODUCT_DRAFT },
    }))
    setEditError(null)
  }

  const saveGroup = async () => {
    if (drafts.some((draft) => !draft.name.trim())) {
      setEditError('Укажите название каждого приёма пищи')
      return
    }
    if (drafts.some((draft) => draft.items.length === 0)) {
      setEditError('В каждом приёме пищи должен остаться хотя бы один продукт')
      return
    }
    if (drafts.some((draft) => draft.items.some((item) => {
      const weight = parseNumber(item.weightInput)
      return !item.weightInput.trim() || !Number.isFinite(weight) || weight <= 0
    }))) {
      setEditError('Укажите граммовку больше нуля для каждого продукта')
      return
    }

    setSaving(true)
    setEditError(null)
    try {
      await onSave(drafts)
      setEditing(false)
      setProductDrafts({})
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Не удалось сохранить группу')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className={expanded ? 'meal-menu-card meal-menu-group-card expanded' : 'meal-menu-card meal-menu-group-card'}
      data-meal-group-key={groupKey}
    >
      <div className="meal-menu-group-card-head">
        <button
          id={buttonId}
          type="button"
          className="meal-menu-trigger meal-menu-group-trigger"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          disabled={Boolean(deletingMealId) || saving}
        >
          <span className="meal-menu-group-label">
            <MealGroupIcon />
            <span className="meal-menu-trigger-main">
              <span>{identifier}</span>
              <MealNutritionInline
                items={meals.flatMap((meal) => meal.items)}
                productMap={productMap}
              />
            </span>
          </span>
          <span className="meal-menu-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
        </button>
        <button
          type="button"
          className="edit-button meal-menu-edit-group"
          onClick={startEditing}
          disabled={actionsDisabled || editing || saving}
          aria-label={`Редактировать группу «${identifier}»`}
          title="Редактировать группу"
        >
          ✎
        </button>
      </div>
      {expanded && (
        <div
          id={panelId}
          className="meal-menu-group-details"
          role="region"
          aria-labelledby={buttonId}
        >
          {meals.map((meal) => {
            const deleting = deletingMealId === meal.id
            const draft = drafts.find((item) => item.id === meal.id)
            const productAddition = productDrafts[meal.id] ?? EMPTY_GROUP_PRODUCT_DRAFT
            return (
              <section key={meal.id} className="meal-menu-group-meal">
                <div className="meal-menu-group-meal-head">
                  <div className="meal-menu-group-meal-title">
                    {editing && draft ? (
                      <input
                        className="meal-menu-group-name-input"
                        type="text"
                        value={draft.name}
                        onChange={(event) => {
                          const name = event.target.value
                          setDrafts((current) => current.map((item) => (
                            item.id === meal.id ? { ...item, name } : item
                          )))
                          setEditError(null)
                        }}
                        maxLength={120}
                        disabled={saving}
                        aria-label={`Название приёма пищи «${meal.name}»`}
                      />
                    ) : <h4>{meal.name}</h4>}
                    <MealNutritionInline
                      items={editing && draft ? draft.items : meal.items}
                      productMap={productMap}
                    />
                  </div>
                  {!editing && (
                    <button
                      type="button"
                      className="delete-button meal-menu-group-action"
                      onClick={() => onDelete(meal)}
                      disabled={actionsDisabled}
                      aria-label={`Удалить приём пищи «${meal.name}»`}
                      title="Удалить приём пищи"
                    >
                      {deleting ? '…' : '×'}
                    </button>
                  )}
                </div>
                <MealItemsTable
                  items={editing && draft ? draft.items : meal.items}
                  productMap={productMap}
                  caption={`Продукты в приёме пищи «${meal.name}»`}
                  editingDisabled={saving}
                  onWeightChange={editing && draft ? (draftId, value) => {
                    const parsedWeight = parseNumber(value)
                    setDrafts((current) => current.map((item) => (
                      item.id === meal.id
                        ? {
                            ...item,
                            items: item.items.map((product) => product.draftId === draftId
                              ? {
                                  ...product,
                                  weightInput: value,
                                  weight_grams: Number.isFinite(parsedWeight) && parsedWeight > 0
                                    ? parsedWeight
                                    : 0,
                                }
                              : product),
                          }
                        : item
                    )))
                    setEditError(null)
                  } : undefined}
                  onRemove={editing && draft ? (draftId) => {
                    setDrafts((current) => current.map((item) => item.id === meal.id
                      ? { ...item, items: item.items.filter((product) => product.draftId !== draftId) }
                      : item))
                    setEditError(null)
                  } : undefined}
                />
                {editing && draft && (
                  <div className="meal-menu-group-product-addition">
                    <label>
                      <span>Добавить продукт</span>
                      <select
                        value={productAddition.productId}
                        onChange={(event) => updateGroupProductDraft(
                          meal.id,
                          'productId',
                          event.target.value,
                        )}
                        disabled={saving || sortedProducts.length === 0}
                        aria-label={`Продукт для приёма пищи «${meal.name}»`}
                      >
                        <option value="">Выберите продукт</option>
                        {sortedProducts.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Вес, г</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        inputMode="decimal"
                        value={productAddition.weightInput}
                        onChange={(event) => updateGroupProductDraft(
                          meal.id,
                          'weightInput',
                          event.target.value,
                        )}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' || event.repeat || saving) return
                          event.preventDefault()
                          addProductToMeal(meal.id)
                        }}
                        disabled={saving}
                        aria-label={`Вес нового продукта для приёма пищи «${meal.name}»`}
                      />
                    </label>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => addProductToMeal(meal.id)}
                      disabled={saving || sortedProducts.length === 0}
                    >
                      Добавить
                    </button>
                  </div>
                )}
              </section>
            )
          })}
          {editing ? (
            <div className="meal-menu-group-confirmation">
              {editError && <p className="meal-menu-error" role="alert">{editError}</p>}
              <div className="meal-menu-editor-actions">
                <button type="button" className="primary" onClick={() => void saveGroup()} disabled={saving}>
                  {saving ? 'Сохранение…' : 'Подтвердить изменения'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditing(false)
                    setDrafts([])
                    setProductDrafts({})
                    setEditError(null)
                  }}
                  disabled={saving}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <MealGroupTotals
              meals={meals}
              identifier={identifier}
              productMap={productMap}
            />
          )}
        </div>
      )}
    </article>
  )
}

export function MealPlannerView({ onOpenMeal }: { onOpenMeal: (groupKey: string) => void }) {
  const {
    savedProducts,
    savedMeals,
    savedMealPlans,
    logFoodToday,
    scheduleSavedMeals,
    deleteSavedMealPlan,
  } = useData()
  const [selectedPlanDate, setSelectedPlanDate] = useState(() => localISODate())
  const [visiblePlanMonth, setVisiblePlanMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedPlanGroupKey, setSelectedPlanGroupKey] = useState('')
  const [planPickerOpen, setPlanPickerOpen] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [copyingToConsumption, setCopyingToConsumption] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planNotice, setPlanNotice] = useState<string | null>(null)
  const [shoppingRangeOpen, setShoppingRangeOpen] = useState(false)
  const [shoppingFrom, setShoppingFrom] = useState(() => localISODate())
  const [shoppingTo, setShoppingTo] = useState(() => localISODate())
  const [shoppingCalendarPickingEnd, setShoppingCalendarPickingEnd] = useState(false)
  const [shoppingError, setShoppingError] = useState<string | null>(null)
  const [shoppingResult, setShoppingResult] = useState<ShoppingListResult | null>(null)
  const planPickerRef = useRef<HTMLDivElement>(null)

  const sortedMeals = useMemo(
    () => [...savedMeals].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [savedMeals],
  )
  const mealGroups = useMemo(() => groupSavedMeals(sortedMeals), [sortedMeals])
  const selectedPlanGroup = mealGroups.find((group) => group.key === selectedPlanGroupKey) ?? null
  const plannedDates = useMemo(
    () => new Set(savedMealPlans.map((plan) => plan.planned_on)),
    [savedMealPlans],
  )
  const selectedDatePlans = useMemo(
    () => savedMealPlans.filter((plan) => plan.planned_on === selectedPlanDate),
    [savedMealPlans, selectedPlanDate],
  )
  const savedProductMap = useMemo(
    () => new Map(savedProducts.map((product) => [product.id, product])),
    [savedProducts],
  )
  const selectedDatePlanNutrition = useMemo(() => new Map(
    selectedDatePlans.map((plan) => {
      const meals = plan.saved_meal_ids.flatMap((mealId) => {
        const meal = savedMeals.find((item) => item.id === mealId)
        return meal ? [meal] : []
      })
      const nutrition = getMealTotals(
        meals.flatMap((meal) => meal.items),
        savedProductMap,
      )
      return [plan.id, {
        ...nutrition,
        hasMissingData: nutrition.hasMissingProduct || meals.length !== plan.saved_meal_ids.length,
      }]
    }),
  ), [savedMeals, savedProductMap, selectedDatePlans])
  const selectedDateTotals = useMemo(() => {
    const totals = [...selectedDatePlanNutrition.values()].reduce<NutritionTotals>(
      (result, nutrition) => ({
        weight: result.weight + nutrition.totals.weight,
        calories: result.calories + nutrition.totals.calories,
        proteins: result.proteins + nutrition.totals.proteins,
        fats: result.fats + nutrition.totals.fats,
        carbohydrates: result.carbohydrates + nutrition.totals.carbohydrates,
      }),
      { weight: 0, calories: 0, proteins: 0, fats: 0, carbohydrates: 0 },
    )
    return {
      totals,
      hasMissingData: [...selectedDatePlanNutrition.values()]
        .some((nutrition) => nutrition.hasMissingData),
    }
  }, [selectedDatePlanNutrition])
  const planMonthDays = new Date(
    visiblePlanMonth.getFullYear(),
    visiblePlanMonth.getMonth() + 1,
    0,
  ).getDate()
  const planFirstWeekday = (new Date(
    visiblePlanMonth.getFullYear(),
    visiblePlanMonth.getMonth(),
    1,
  ).getDay() + 6) % 7

  useEffect(() => {
    if (!planPickerOpen) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!planPickerRef.current?.contains(event.target as Node)) {
        setPlanPickerOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlanPickerOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [planPickerOpen])

  useEffect(() => {
    if (!shoppingResult) return undefined

    document.body.classList.add('meal-menu-shopping-print-active')
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShoppingResult(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.classList.remove('meal-menu-shopping-print-active')
      document.body.classList.remove('meal-menu-shopping-print-monochrome')
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [shoppingResult])

  const handlePrintShoppingList = (monochrome: boolean) => {
    document.body.classList.toggle('meal-menu-shopping-print-monochrome', monochrome)
    const clearPrintMode = () => {
      document.body.classList.remove('meal-menu-shopping-print-monochrome')
    }
    window.addEventListener('afterprint', clearPrintMode, { once: true })
    window.print()
  }

  const handleScheduleMealGroup = async () => {
    const group = mealGroups.find((item) => item.key === selectedPlanGroupKey)
    if (!group) {
      setPlanError('Выберите приём пищи или группу')
      return
    }
    setPlanBusy(true)
    setPlanError(null)
    setPlanNotice(null)
    try {
      await scheduleSavedMeals(selectedPlanDate, group.meals.map((meal) => meal.id))
      setSelectedPlanGroupKey('')
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Не удалось сохранить план питания')
    } finally {
      setPlanBusy(false)
    }
  }

  const handleDeleteMealPlan = async (id: string, savedMealIds: string[], label: string) => {
    const selectedDateLabel = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${selectedPlanDate}T12:00:00`))
    const confirmed = window.confirm(
      savedMealIds.length > 1
        ? `Удалить группу приёмов пищи «${label}» из планировщика на ${selectedDateLabel}?`
        : `Удалить приём пищи «${label}» из планировщика на ${selectedDateLabel}?`,
    )
    if (!confirmed) return

    setDeletingPlanId(id)
    setPlanError(null)
    setPlanNotice(null)
    try {
      await deleteSavedMealPlan(id)
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Не удалось удалить приём пищи из планировщика')
    } finally {
      setDeletingPlanId(null)
    }
  }

  const handleCopyToConsumption = async () => {
    if (selectedDatePlans.length === 0) {
      setPlanError('На выбранную дату нет сохранённых приёмов пищи')
      return
    }

    const plannedMeals = selectedDatePlans.flatMap((plan) => plan.saved_meal_ids.flatMap((mealId) => {
      const meal = savedMeals.find((item) => item.id === mealId)
      return meal ? [meal] : []
    }))
    const plannedMealCount = selectedDatePlans.reduce(
      (count, plan) => count + plan.saved_meal_ids.length,
      0,
    )
    if (plannedMeals.length !== plannedMealCount) {
      setPlanError('Один из сохранённых приёмов пищи был удалён. Обновите план выбранного дня')
      return
    }

    const products = plannedMeals.flatMap((meal) => meal.items.map((item) => ({
      item,
      product: savedProductMap.get(item.saved_product_id),
    })))
    if (products.length === 0) {
      setPlanError('В выбранном приёме пищи нет продуктов')
      return
    }
    if (products.some(({ product }) => !product)) {
      setPlanError('Один из продуктов был удалён. Обновите выбранный приём пищи перед копированием')
      return
    }

    const sourceDate = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${selectedPlanDate}T12:00:00`))
    const confirmed = window.confirm(
      `Скопировать все приёмы пищи, сохранённые на ${sourceDate}, в потребление за сегодня? Будут добавлены все продукты с указанными граммовками.`,
    )
    if (!confirmed) return

    setCopyingToConsumption(true)
    setPlanError(null)
    setPlanNotice(null)
    try {
      for (const { item, product } of products) {
        if (!product) continue
        await logFoodToday(
          product.name,
          item.weight_grams,
          product.calories_per_100g,
          product.proteins_per_100g,
          product.fats_per_100g,
          product.carbohydrates_per_100g,
        )
      }
      setPlanNotice('Все продукты добавлены в потребление за сегодня')
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Не удалось скопировать продукты в потребление')
    } finally {
      setCopyingToConsumption(false)
    }
  }

  const handleShoppingCalendarDate = (date: string) => {
    if (!shoppingRangeOpen) return

    if (!shoppingCalendarPickingEnd) {
      setShoppingFrom(date)
      setShoppingTo('')
      setShoppingCalendarPickingEnd(true)
    } else {
      setShoppingFrom(date < shoppingFrom ? date : shoppingFrom)
      setShoppingTo(date < shoppingFrom ? shoppingFrom : date)
      setShoppingCalendarPickingEnd(false)
    }
    setShoppingError(null)
  }

  const handleCalculateShopping = () => {
    if (!shoppingFrom || !shoppingTo) {
      setShoppingError('Выберите начальную и конечную даты периода')
      return
    }
    if (shoppingFrom > shoppingTo) {
      setShoppingError('Начальная дата не может быть позже конечной')
      return
    }

    const periodPlans = savedMealPlans.filter((plan) => (
      plan.planned_on >= shoppingFrom && plan.planned_on <= shoppingTo
    ))
    if (periodPlans.length === 0) {
      setShoppingError('В выбранном периоде нет запланированных приёмов пищи')
      return
    }

    const productWeights = new Map<string, { name: string; weightGrams: number }>()
    for (const plan of periodPlans) {
      for (const mealId of plan.saved_meal_ids) {
        const meal = savedMeals.find((item) => item.id === mealId)
        if (!meal) continue
        for (const item of meal.items) {
          const product = savedProductMap.get(item.saved_product_id)
          const current = productWeights.get(item.saved_product_id)
          productWeights.set(item.saved_product_id, {
            name: product?.name ?? 'Удалённый продукт',
            weightGrams: (current?.weightGrams ?? 0) + item.weight_grams,
          })
        }
      }
    }

    const items = [...productWeights.entries()]
      .map(([productId, item]) => ({ productId, ...item }))
      .sort((left, right) => MENU_NAME_COLLATOR.compare(left.name, right.name))
    if (items.length === 0) {
      setShoppingError('В запланированных приёмах пищи нет продуктов')
      return
    }

    setShoppingError(null)
    setShoppingResult({ from: shoppingFrom, to: shoppingTo, items })
  }

  const getPlanLabel = (mealIds: string[]) => {
    const meals = mealIds.flatMap((id) => {
      const meal = savedMeals.find((item) => item.id === id)
      return meal ? [meal] : []
    })
    if (meals.length > 1) {
      const identifier = getMealGroupIdentifier(meals[0].name)
      const normalizedIdentifier = identifier
        ? normalizeMealGroupIdentifier(identifier)
        : null
      if (
        identifier
        && normalizedIdentifier
        && meals.every((meal) => {
          const mealIdentifier = getMealGroupIdentifier(meal.name)
          return mealIdentifier !== null
            && normalizeMealGroupIdentifier(mealIdentifier) === normalizedIdentifier
        })
      ) {
        return identifier
      }
    }
    return meals.map((meal) => meal.name).join(', ') || 'Удалённый приём пищи'
  }

  const getPlanGroup = (mealIds: string[]) => (
    mealGroups.find((group) => group.meals.some((meal) => mealIds.includes(meal.id))) ?? null
  )

  return (
    <section className="meal-menu meal-planner-view" aria-label="Планировщик питания">
      <section className="meal-menu-planner" aria-label="Календарь меню">
        <div className="diary-calendar meal-menu-calendar">
          <div className="calendar-head">
            <button type="button" className="calendar-nav" onClick={() => setVisiblePlanMonth(new Date(visiblePlanMonth.getFullYear(), visiblePlanMonth.getMonth() - 1, 1))} aria-label="Предыдущий месяц">←</button>
            <h2>{MENU_MONTHS[visiblePlanMonth.getMonth()]} {visiblePlanMonth.getFullYear()}</h2>
            <button type="button" className="calendar-nav" onClick={() => setVisiblePlanMonth(new Date(visiblePlanMonth.getFullYear(), visiblePlanMonth.getMonth() + 1, 1))} aria-label="Следующий месяц">→</button>
          </div>
          <div className="calendar-grid" role="grid" aria-label="Календарь меню">
            {MENU_WEEKDAYS.map((weekday) => <span key={weekday} className="calendar-weekday">{weekday}</span>)}
            {Array.from({ length: planFirstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
            {Array.from({ length: planMonthDays }, (_, index) => index + 1).map((day) => {
              const date = localISODate(new Date(visiblePlanMonth.getFullYear(), visiblePlanMonth.getMonth(), day))
              const shoppingRangeSelected = shoppingRangeOpen
                && shoppingFrom
                && shoppingTo
                && date >= shoppingFrom
                && date <= shoppingTo
              const classes = [
                'calendar-day',
                plannedDates.has(date) ? 'has-meal-plan' : '',
                selectedPlanDate === date ? 'selected' : '',
                localISODate() === date ? 'today' : '',
                shoppingRangeSelected ? 'shopping-range' : '',
                shoppingRangeOpen && date === shoppingFrom ? 'shopping-range-start' : '',
                shoppingRangeOpen && date === shoppingTo ? 'shopping-range-end' : '',
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={date}
                  type="button"
                  className={classes}
                  onClick={() => {
                    setSelectedPlanDate(date)
                    handleShoppingCalendarDate(date)
                    setPlanError(null)
                    setPlanNotice(null)
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <p className="calendar-hint">Выделенные дни содержат сохранённое меню.</p>
        </div>
        <div className="meal-menu-plan-controls">
          <h3>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${selectedPlanDate}T12:00:00`))}</h3>
          <div className="meal-menu-plan-form">
            <div className="meal-menu-plan-selection">
              <div ref={planPickerRef} className="meal-menu-plan-picker">
              <button
                type="button"
                className="meal-menu-plan-picker-trigger"
                onClick={() => setPlanPickerOpen((open) => !open)}
                disabled={planBusy || copyingToConsumption}
                aria-label="Приём пищи или группа"
                aria-haspopup="listbox"
                aria-expanded={planPickerOpen}
              >
                <span className="meal-menu-plan-picker-label">
                  {selectedPlanGroup && selectedPlanGroup.identifier !== null && <MealGroupIcon />}
                  <span>
                    {selectedPlanGroup
                      ? selectedPlanGroup.identifier !== null
                        ? `${selectedPlanGroup.identifier} — группа`
                        : selectedPlanGroup.meals[0].name
                      : 'Выберите приём пищи'}
                  </span>
                </span>
                <span className="meal-menu-plan-picker-chevron" aria-hidden="true">
                  {planPickerOpen ? '⌃' : '⌄'}
                </span>
              </button>
              {planPickerOpen && (
                <div className="meal-menu-plan-picker-options" role="listbox" aria-label="Сохранённые приёмы пищи">
                  {mealGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      className="meal-menu-plan-picker-option"
                      role="option"
                      aria-selected={selectedPlanGroupKey === group.key}
                      onClick={() => {
                        setSelectedPlanGroupKey(group.key)
                        setPlanPickerOpen(false)
                        setPlanError(null)
                        setPlanNotice(null)
                      }}
                    >
                      <span className="meal-menu-plan-picker-label">
                        {group.identifier !== null && <MealGroupIcon />}
                        <span>
                          {group.identifier !== null
                            ? `${group.identifier} — группа`
                            : group.meals[0].name}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              </div>
              <button
                type="button"
                className="meal-menu-shopping-toggle"
                aria-expanded={shoppingRangeOpen}
                onClick={() => {
                  setShoppingRangeOpen((open) => {
                    if (!open) {
                      setShoppingFrom(selectedPlanDate)
                      setShoppingTo(selectedPlanDate)
                      setShoppingCalendarPickingEnd(false)
                      setShoppingError(null)
                    }
                    return !open
                  })
                }}
              >
                Рассчитать закупки
              </button>
            </div>
            <div className="meal-menu-plan-actions">
              <button
                type="button"
                className="meal-menu-copy-consumption"
                onClick={() => void handleCopyToConsumption()}
                disabled={planBusy || copyingToConsumption || selectedDatePlans.length === 0}
              >
                {copyingToConsumption ? 'Копирование…' : 'Копировать в потребление'}
              </button>
              <button type="button" className="primary" onClick={() => void handleScheduleMealGroup()} disabled={planBusy || copyingToConsumption || !selectedPlanGroupKey}>{planBusy ? 'Сохранение…' : 'Сохранить на дату'}</button>
            </div>
            {shoppingRangeOpen && (
              <section className="meal-menu-shopping-range" aria-label="Период расчёта закупок">
                <p>Укажите даты или выберите начало и конец периода в календаре.</p>
                <div className="meal-menu-shopping-dates">
                  <label>
                    <span>Начальная дата</span>
                    <input
                      type="date"
                      value={shoppingFrom}
                      onChange={(event) => {
                        setShoppingFrom(event.target.value)
                        setShoppingCalendarPickingEnd(false)
                        setShoppingError(null)
                      }}
                    />
                  </label>
                  <label>
                    <span>Конечная дата</span>
                    <input
                      type="date"
                      value={shoppingTo}
                      onChange={(event) => {
                        setShoppingTo(event.target.value)
                        setShoppingCalendarPickingEnd(false)
                        setShoppingError(null)
                      }}
                    />
                  </label>
                </div>
                {shoppingCalendarPickingEnd && (
                  <p className="meal-menu-shopping-hint" role="status">
                    Теперь выберите конечную дату в календаре.
                  </p>
                )}
                {shoppingError && <p className="meal-menu-error" role="alert">{shoppingError}</p>}
                <button type="button" className="primary" onClick={handleCalculateShopping}>
                  Рассчитать
                </button>
              </section>
            )}
          </div>
          {planError && <p className="meal-menu-error" role="alert">{planError}</p>}
          {planNotice && <p className="meal-menu-plan-notice" role="status">{planNotice}</p>}
          <div className="meal-menu-day-plans">
            {selectedDatePlans.length === 0 ? <p className="empty">На эту дату меню не запланировано</p> : selectedDatePlans.map((plan) => {
              const planLabel = getPlanLabel(plan.saved_meal_ids)
              const planGroup = getPlanGroup(plan.saved_meal_ids)
              const groupKey = planGroup?.key ?? null
              const nutrition = selectedDatePlanNutrition.get(plan.id)
              return (
                <div key={plan.id} className="meal-menu-day-plan">
                  <button
                    type="button"
                    className="meal-menu-day-plan-link"
                    onClick={() => groupKey && onOpenMeal(groupKey)}
                    disabled={!groupKey}
                    title={groupKey ? 'Открыть в меню' : undefined}
                  >
                    {planGroup?.identifier && <MealGroupIcon />}
                    <span>{planLabel}</span>
                  </button>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => void handleDeleteMealPlan(plan.id, plan.saved_meal_ids, planLabel)}
                    disabled={deletingPlanId === plan.id}
                    aria-label={`Удалить план «${planLabel}»`}
                  >
                    {deletingPlanId === plan.id ? '…' : '×'}
                  </button>
                  {nutrition && (
                    <p className="meal-menu-day-plan-nutrition">
                      <strong>КБЖУ:</strong>
                      <span>{nutrition.hasMissingData ? '—' : `${formatNumber(nutrition.totals.calories, 0)} ккал`}</span>
                      <span>Б {nutrition.hasMissingData ? '—' : `${formatNumber(nutrition.totals.proteins)} г`}</span>
                      <span>Ж {nutrition.hasMissingData ? '—' : `${formatNumber(nutrition.totals.fats)} г`}</span>
                      <span>У {nutrition.hasMissingData ? '—' : `${formatNumber(nutrition.totals.carbohydrates)} г`}</span>
                    </p>
                  )}
                </div>
              )
            })}
            {selectedDatePlans.length > 1 && (
              <div className="meal-menu-day-plan-total" aria-label="Общие КБЖУ запланированных приёмов пищи">
                <strong>Общие КБЖУ</strong>
                <span>{selectedDateTotals.hasMissingData ? '—' : `${formatNumber(selectedDateTotals.totals.calories, 0)} ккал`}</span>
                <span>Б {selectedDateTotals.hasMissingData ? '—' : `${formatNumber(selectedDateTotals.totals.proteins)} г`}</span>
                <span>Ж {selectedDateTotals.hasMissingData ? '—' : `${formatNumber(selectedDateTotals.totals.fats)} г`}</span>
                <span>У {selectedDateTotals.hasMissingData ? '—' : `${formatNumber(selectedDateTotals.totals.carbohydrates)} г`}</span>
              </div>
            )}
          </div>
        </div>
      </section>
      {shoppingResult && (
        <div
          className="modal-overlay meal-menu-shopping-overlay"
          role="presentation"
          onClick={() => setShoppingResult(null)}
        >
          <section
            className="modal-content meal-menu-shopping-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-menu-shopping-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="meal-menu-shopping-print-brand" aria-hidden="true">
              <img src="/favicon.png" alt="" />
              <span>MLF</span>
            </div>
            <header className="meal-menu-shopping-modal-head">
              <div>
                <h3 id="meal-menu-shopping-title">Список закупок</h3>
                <p>
                  {new Intl.DateTimeFormat('ru-RU').format(new Date(`${shoppingResult.from}T12:00:00`))}
                  {' — '}
                  {new Intl.DateTimeFormat('ru-RU').format(new Date(`${shoppingResult.to}T12:00:00`))}
                </p>
              </div>
              <button
                type="button"
                className="icon-close meal-menu-shopping-close"
                onClick={() => setShoppingResult(null)}
                aria-label="Закрыть список закупок"
                autoFocus
              >
                ×
              </button>
            </header>
            <div className="meal-menu-shopping-table-wrap">
              <table className="meal-menu-shopping-table">
                <thead>
                  <tr>
                    <th scope="col">Продукт</th>
                    <th scope="col">Вес</th>
                  </tr>
                </thead>
                <tbody>
                  {shoppingResult.items.map((item) => (
                    <tr key={item.productId}>
                      <th scope="row">{item.name}</th>
                      <td>{formatNumber(item.weightGrams)} г</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="meal-menu-shopping-modal-actions">
              <button type="button" className="ghost" onClick={() => handlePrintShoppingList(false)}>
                Распечатать
              </button>
              <button type="button" className="ghost" onClick={() => handlePrintShoppingList(true)}>
                Распечатать с белым фоном
              </button>
              <button type="button" className="ghost" onClick={() => setShoppingResult(null)}>
                Закрыть
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export function MealMenuView({
  focusRequest,
}: {
  focusRequest?: { groupKey: string; requestId: number } | null
}) {
  const {
    savedProducts,
    savedMeals,
    addSavedProduct,
    addSavedMeal,
    updateSavedMeal,
    deleteSavedMeal,
  } = useData()
  const formHeadingId = useId()
  const productSuggestionsId = useId()
  const menuInfoId = useId()
  const draftCounter = useRef(0)
  const editorRef = useRef<HTMLElement>(null)
  const mealListRef = useRef<HTMLDivElement>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [mealName, setMealName] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productDraft, setProductDraft] = useState<MealProductDraft>(EMPTY_PRODUCT_DRAFT)
  const [draftItems, setDraftItems] = useState<DraftMealItem[]>([])
  const [expandedMealGroupKey, setExpandedMealGroupKey] = useState<string | null>(
    () => focusRequest?.groupKey ?? null,
  )
  const [editorError, setEditorError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [productSuggestionsOpen, setProductSuggestionsOpen] = useState(false)
  const [menuInfoOpen, setMenuInfoOpen] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sortedSavedProducts = useMemo(
    () => [...savedProducts].sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [savedProducts],
  )
  const savedProductMap = useMemo(
    () => new Map(savedProducts.map((product) => [product.id, product])),
    [savedProducts],
  )
  const productSuggestions = useMemo(() => {
    const query = normalizeProductName(productDraft.productName)
    if (!query || selectedProductId) return []
    return savedProducts
      .filter((product) => normalizeProductName(product.name).includes(query))
      .slice(0, 6)
  }, [productDraft.productName, savedProducts, selectedProductId])
  const sortedMeals = useMemo(
    () => [...savedMeals].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [savedMeals],
  )
  const mealGroups = useMemo(() => groupSavedMeals(sortedMeals), [sortedMeals])

  useEffect(() => {
    if (!focusRequest || !mealGroups.some((group) => group.key === focusRequest.groupKey)) return

    window.requestAnimationFrame(() => {
      const card = Array.from(
        mealListRef.current?.querySelectorAll<HTMLElement>('[data-meal-group-key]') ?? [],
      ).find((element) => element.dataset.mealGroupKey === focusRequest.groupKey)
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      card?.querySelector<HTMLButtonElement>('.meal-menu-trigger')?.focus({ preventScroll: true })
    })
  }, [focusRequest, mealGroups])
  const busy = addingProduct || submitting
  const selectedProduct = selectedProductId ? savedProductMap.get(selectedProductId) ?? null : null
  const existingProductSelected = Boolean(selectedProductId)

  const resetProductDraft = () => {
    setSelectedProductId('')
    setProductDraft(EMPTY_PRODUCT_DRAFT)
    setProductSuggestionsOpen(false)
  }

  const resetEditor = () => {
    setEditingMealId(null)
    setMealName('')
    setDraftItems([])
    setEditorError(null)
    resetProductDraft()
  }

  const appendDraftItem = (productId: string, weightGrams: number) => {
    draftCounter.current += 1
    setDraftItems((current) => [...current, {
      draftId: `meal-product-${draftCounter.current}`,
      saved_product_id: productId,
      weight_grams: weightGrams,
      weightInput: String(weightGrams),
    }])
  }

  const handleWeightChange = (draftId: string, value: string) => {
    const parsedWeight = parseNumber(value)
    setDraftItems((current) => current.map((item) => (
      item.draftId === draftId
        ? {
            ...item,
            weightInput: value,
            weight_grams: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 0,
          }
        : item
    )))
    setEditorError(null)
  }

  const handleEditMeal = (meal: SavedMeal) => {
    setEditingMealId(meal.id)
    setMealName(meal.name)
    setDraftItems(meal.items.map((item) => {
      draftCounter.current += 1
      return {
        ...item,
        draftId: `meal-product-${draftCounter.current}`,
        weightInput: String(item.weight_grams),
      }
    }))
    resetProductDraft()
    setEditorError(null)
    setListError(null)
    setEditorOpen(true)
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleProductSelection = (productId: string) => {
    setSelectedProductId(productId)
    setEditorError(null)
    setProductSuggestionsOpen(false)
    if (!productId) {
      setProductDraft((current) => ({
        ...EMPTY_PRODUCT_DRAFT,
        weightGrams: current.weightGrams,
      }))
      return
    }

    const product = savedProductMap.get(productId)
    if (!product) {
      setEditorError('Выбранный продукт больше не найден. Выберите другой продукт.')
      return
    }
    setProductDraft((current) => ({
      productName: product.name,
      weightGrams: current.weightGrams,
      caloriesPer100g: String(product.calories_per_100g),
      proteinsPer100g: String(product.proteins_per_100g),
      fatsPer100g: String(product.fats_per_100g),
      carbohydratesPer100g: String(product.carbohydrates_per_100g),
      category: product.category,
    }))
  }

  const updateProductDraft = (field: keyof MealProductDraft, value: string) => {
    setProductDraft((current) => ({ ...current, [field]: value }))
    setEditorError(null)
  }

  const handleAddProduct = async () => {
    const weight = parseNumber(productDraft.weightGrams)
    if (!Number.isFinite(weight) || weight <= 0) {
      setEditorError('Укажите вес продукта больше нуля')
      return
    }
    if (draftItems.length >= 100) {
      setEditorError('В один приём пищи можно добавить не более 100 продуктов')
      return
    }

    if (selectedProductId) {
      if (!savedProductMap.has(selectedProductId)) {
        setEditorError('Выбранный продукт больше не найден. Выберите другой продукт.')
        return
      }
      appendDraftItem(selectedProductId, weight)
      setEditorError(null)
      resetProductDraft()
      return
    }

    const productName = productDraft.productName.trim()
    const calories = parseNumber(productDraft.caloriesPer100g)
    const proteins = parseNumber(productDraft.proteinsPer100g)
    const fats = parseNumber(productDraft.fatsPer100g)
    const carbohydrates = parseNumber(productDraft.carbohydratesPer100g)

    if (!productName) {
      setEditorError('Укажите название продукта')
      return
    }
    if (
      !productDraft.caloriesPer100g.trim()
      || !productDraft.proteinsPer100g.trim()
      || !productDraft.fatsPer100g.trim()
      || !productDraft.carbohydratesPer100g.trim()
    ) {
      setEditorError('Заполните все значения КБЖУ на 100 г')
      return
    }
    if (!Number.isFinite(calories) || calories <= 0) {
      setEditorError('Калорийность на 100 г должна быть больше нуля')
      return
    }
    if (
      !Number.isFinite(proteins) || proteins < 0
      || !Number.isFinite(fats) || fats < 0
      || !Number.isFinite(carbohydrates) || carbohydrates < 0
    ) {
      setEditorError('Белки, жиры и углеводы не могут быть отрицательными')
      return
    }

    const duplicate = savedProducts.find(
      (product) => normalizeProductName(product.name) === normalizeProductName(productName),
    )
    if (duplicate) {
      setEditorError(`Продукт «${duplicate.name}» уже сохранён. Выберите его из списка.`)
      return
    }

    setAddingProduct(true)
    setEditorError(null)
    try {
      const savedProduct = await addSavedProduct(
        productName,
        calories,
        proteins,
        fats,
        carbohydrates,
        productDraft.category,
        false,
      )
      appendDraftItem(savedProduct.id, weight)
      resetProductDraft()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setEditorError(
        /duplicate|unique|уже (?:есть|существует|сохран)/iu.test(message)
          ? 'Продукт с таким названием уже сохранён. Выберите его из списка.'
          : message || 'Не удалось сохранить продукт',
      )
    } finally {
      setAddingProduct(false)
    }
  }

  const handleSaveMeal = async () => {
    if (!mealName.trim()) {
      setEditorError('Укажите название приёма пищи')
      return
    }
    if (!draftItems.length) {
      setEditorError('Добавьте хотя бы один продукт')
      return
    }
    if (draftItems.some((item) => {
      const weight = parseNumber(item.weightInput)
      return !item.weightInput.trim() || !Number.isFinite(weight) || weight <= 0
    })) {
      setEditorError('Укажите граммовку больше нуля для каждого продукта')
      return
    }
    if (draftItems.some((item) => !savedProductMap.has(item.saved_product_id))) {
      setEditorError('Один из продуктов был удалён. Уберите его из списка перед сохранением.')
      return
    }

    setSubmitting(true)
    setEditorError(null)
    try {
      const items: SavedMealItem[] = draftItems.map(({
        draftId: _draftId,
        weightInput,
        ...item
      }) => ({
        ...item,
        weight_grams: parseNumber(weightInput),
      }))
      if (editingMealId) {
        await updateSavedMeal(editingMealId, mealName.trim(), items)
      } else {
        await addSavedMeal(mealName.trim(), items)
      }
      setExpandedMealGroupKey(null)
      resetEditor()
      setEditorOpen(false)
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Не удалось сохранить приём пищи')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMeal = async (meal: SavedMeal, groupKey: string) => {
    const confirmed = window.confirm(`Удалить приём пищи «${meal.name}»?`)
    if (!confirmed) return

    setDeletingMealId(meal.id)
    setListError(null)
    try {
      await deleteSavedMeal(meal.id)
      setExpandedMealGroupKey((current) => current === groupKey ? null : current)
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Не удалось удалить приём пищи')
    } finally {
      setDeletingMealId(null)
    }
  }

  return (
    <section className="meal-menu" aria-label="Сохранённые приёмы пищи">
      <div className="meal-menu-toolbar">
        {!editorOpen && (
          <button
            type="button"
            className="add-button meal-menu-add-button"
            onClick={() => {
              resetEditor()
              setEditorOpen(true)
            }}
          >
            Добавить приём пищи
          </button>
        )}
      </div>

      {editorOpen && (
        <section ref={editorRef} className="meal-menu-editor" aria-labelledby={formHeadingId} aria-busy={busy}>
          <h3 id={formHeadingId}>{editingMealId ? 'Редактировать приём пищи' : 'Новый приём пищи'}</h3>

          <div className="form-group meal-menu-name-field">
            <label htmlFor="meal-menu-name">Название приёма пищи</label>
            <input
              id="meal-menu-name"
              type="text"
              value={mealName}
              onChange={(event) => {
                setMealName(event.target.value)
                setEditorError(null)
              }}
              placeholder="Например, завтрак"
              maxLength={120}
              autoComplete="off"
              disabled={busy}
            />
          </div>

          <fieldset className="meal-menu-product-editor" disabled={busy}>
            <legend>Добавить продукт</legend>

            <div className="meal-menu-product-main-grid">
              <div className="form-group meal-menu-saved-product-field">
                <label htmlFor="meal-menu-saved-product">Из сохранённых продуктов</label>
                <select
                  id="meal-menu-saved-product"
                  value={selectedProductId}
                  onChange={(event) => handleProductSelection(event.target.value)}
                >
                  <option value="">Ввести новый продукт</option>
                  {sortedSavedProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group meal-menu-product-name-field">
                <label htmlFor="meal-menu-product-name">Название продукта</label>
                <div
                  className="product-name-autocomplete"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setProductSuggestionsOpen(false)
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setProductSuggestionsOpen(false)
                  }}
                >
                  <input
                    id="meal-menu-product-name"
                    type="text"
                    value={selectedProduct?.name ?? productDraft.productName}
                    onChange={(event) => {
                      updateProductDraft('productName', event.target.value)
                      setProductSuggestionsOpen(true)
                    }}
                    onFocus={() => setProductSuggestionsOpen(true)}
                    placeholder="Название"
                    maxLength={160}
                    autoComplete="off"
                    disabled={busy || existingProductSelected}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={productSuggestionsOpen && productSuggestions.length > 0}
                    aria-controls={productSuggestionsId}
                  />
                  {productSuggestionsOpen && productSuggestions.length > 0 && (
                    <div id={productSuggestionsId} className="product-name-suggestions" role="listbox">
                      {productSuggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="product-name-suggestion"
                          role="option"
                          aria-selected={false}
                          onClick={() => handleProductSelection(product.id)}
                        >
                          <strong>{product.name}</strong>
                          <span>
                            {product.calories_per_100g} ккал · Б {product.proteins_per_100g}
                            {' · '}Ж {product.fats_per_100g} · У {product.carbohydrates_per_100g}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group meal-menu-weight-field">
                <label htmlFor="meal-menu-weight">Вес, г</label>
                <input
                  id="meal-menu-weight"
                  type="number"
                  value={productDraft.weightGrams}
                  onChange={(event) => updateProductDraft('weightGrams', event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key !== 'Enter'
                      || event.repeat
                      || !selectedProductId
                      || busy
                    ) return

                    event.preventDefault()
                    void handleAddProduct()
                  }}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                />
              </div>

              <div className="form-group meal-menu-product-category-field">
                <label htmlFor="meal-menu-product-category">Категория</label>
                <select
                  id="meal-menu-product-category"
                  value={selectedProduct?.category ?? productDraft.category}
                  onChange={(event) => updateProductDraft('category', event.target.value)}
                  disabled={busy || existingProductSelected}
                >
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="meal-menu-nutrition-label">КБЖУ на 100 г</p>
            <div className="meal-menu-nutrition-grid">
              <div className="form-group">
                <label htmlFor="meal-menu-calories">Ккал</label>
                <input
                  id="meal-menu-calories"
                  type="number"
                  value={selectedProduct ? String(selectedProduct.calories_per_100g) : productDraft.caloriesPer100g}
                  onChange={(event) => updateProductDraft('caloriesPer100g', event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  disabled={busy || existingProductSelected}
                />
              </div>
              <div className="form-group">
                <label htmlFor="meal-menu-proteins">Белки, г</label>
                <input
                  id="meal-menu-proteins"
                  type="number"
                  value={selectedProduct ? String(selectedProduct.proteins_per_100g) : productDraft.proteinsPer100g}
                  onChange={(event) => updateProductDraft('proteinsPer100g', event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  disabled={busy || existingProductSelected}
                />
              </div>
              <div className="form-group">
                <label htmlFor="meal-menu-fats">Жиры, г</label>
                <input
                  id="meal-menu-fats"
                  type="number"
                  value={selectedProduct ? String(selectedProduct.fats_per_100g) : productDraft.fatsPer100g}
                  onChange={(event) => updateProductDraft('fatsPer100g', event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  disabled={busy || existingProductSelected}
                />
              </div>
              <div className="form-group">
                <label htmlFor="meal-menu-carbohydrates">Углеводы, г</label>
                <input
                  id="meal-menu-carbohydrates"
                  type="number"
                  value={selectedProduct ? String(selectedProduct.carbohydrates_per_100g) : productDraft.carbohydratesPer100g}
                  onChange={(event) => updateProductDraft('carbohydratesPer100g', event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  disabled={busy || existingProductSelected}
                />
              </div>
            </div>

            {!existingProductSelected && (
              <p className="meal-menu-product-note">
                Новый продукт будет сохранён в разделе «Продукты».
              </p>
            )}

            <button
              type="button"
              className="ghost meal-menu-add-product"
              onClick={() => void handleAddProduct()}
              disabled={busy}
            >
              {addingProduct ? 'Сохранение продукта…' : 'Добавить продукт'}
            </button>
          </fieldset>

          {draftItems.length > 0 && (
            <div className="meal-menu-draft">
              <h4>Продукты в приёме пищи</h4>
              <MealItemsTable
                items={draftItems}
                productMap={savedProductMap}
                caption="Добавленные продукты и общее КБЖУ"
                editingDisabled={busy}
                onWeightChange={handleWeightChange}
                onRemove={(draftId) => {
                  setDraftItems((current) => current.filter((item) => item.draftId !== draftId))
                  setEditorError(null)
                }}
              />
            </div>
          )}

          {addingProduct && <p className="empty" role="status">Новый продукт сохраняется в разделе «Продукты»…</p>}
          {editorError && <p className="meal-menu-error" role="alert">{editorError}</p>}

          <div className="meal-menu-editor-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void handleSaveMeal()}
              disabled={busy}
            >
              {submitting
                ? 'Сохранение…'
                : editingMealId ? 'Сохранить изменения' : 'Сохранить приём пищи'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                resetEditor()
                setEditorOpen(false)
              }}
              disabled={busy}
            >
              Отмена
            </button>
          </div>
        </section>
      )}

      <div ref={mealListRef} className="meal-menu-list">
        <div className="meal-menu-list-heading">
          <h3>Сохранённые приёмы пищи</h3>
          <button
            type="button"
            className="info-button"
            aria-label="Информация о группировке приёмов пищи"
            aria-expanded={menuInfoOpen}
            aria-controls={menuInfoId}
            onClick={() => setMenuInfoOpen((open) => !open)}
          >
            i
          </button>
        </div>
        {menuInfoOpen && (
          <p id={menuInfoId} className="meal-menu-list-info">
            если к названию приема пищи добавить скобки и внутри задать одинаковые символы для разных приемов пищи, они группируются, например (день 1). Регистр букв не учитывается
          </p>
        )}
        {listError && <p className="meal-menu-error" role="alert">{listError}</p>}
        {sortedMeals.length === 0 ? (
          <p className="empty">Сохранённых приёмов пищи пока нет</p>
        ) : mealGroups.map((group) => {
          const expanded = expandedMealGroupKey === group.key
          const toggleGroup = () => setExpandedMealGroupKey((current) => (
            current === group.key ? null : group.key
          ))

          if (group.identifier !== null) {
            return (
              <SavedMealGroupCard
                key={group.key}
                groupKey={group.key}
                identifier={group.identifier}
                meals={group.meals}
                productMap={savedProductMap}
                expanded={expanded}
                deletingMealId={deletingMealId}
                actionsDisabled={Boolean(deletingMealId) || editorOpen}
                onToggle={toggleGroup}
                onSave={async (drafts) => {
                  await Promise.all(drafts.map((draft) => {
                    const items: SavedMealItem[] = draft.items.map(({
                      draftId: _draftId,
                      weightInput,
                      ...item
                    }) => ({
                      ...item,
                      weight_grams: parseNumber(weightInput),
                    }))
                    return updateSavedMeal(draft.id, draft.name.trim(), items)
                  }))
                  setExpandedMealGroupKey(null)
                }}
                onDelete={(meal) => void handleDeleteMeal(meal, group.key)}
              />
            )
          }

          const meal = group.meals[0]
          return (
            <SavedMealCard
              key={group.key}
              groupKey={group.key}
              meal={meal}
              productMap={savedProductMap}
              expanded={expanded}
              deleting={deletingMealId === meal.id}
              actionsDisabled={Boolean(deletingMealId) || editorOpen}
              onToggle={toggleGroup}
              onEdit={() => handleEditMeal(meal)}
              onDelete={() => void handleDeleteMeal(meal, group.key)}
            />
          )
        })}
      </div>
    </section>
  )
}
