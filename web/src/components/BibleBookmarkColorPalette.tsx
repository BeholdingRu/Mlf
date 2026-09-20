import type { CSSProperties } from 'react'
import { BIBLE_BOOKMARK_COLORS } from '../lib/bible-bookmark-colors'

type BibleBookmarkColorPaletteProps = {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  compact?: boolean
  ariaLabel?: string
  colorLabels?: Record<string, string>
}

export function BibleBookmarkColorPalette({
  value,
  onChange,
  disabled = false,
  compact = false,
  ariaLabel = 'Цвет закладки',
  colorLabels,
}: BibleBookmarkColorPaletteProps) {
  return (
    <span
      className={`bible-bookmark-color-palette${compact ? ' compact' : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {BIBLE_BOOKMARK_COLORS.map((color) => {
        const displayName = colorLabels?.[color.value]?.trim() || color.label
        return (
          <button
            key={color.value}
            type="button"
            className={value === color.value ? 'selected' : ''}
            style={{ '--bookmark-option-color': color.value } as CSSProperties}
            role="radio"
            aria-checked={value === color.value}
            aria-label={displayName}
            title={displayName}
            disabled={disabled}
            onClick={() => onChange(color.value)}
          />
        )
      })}
    </span>
  )
}
