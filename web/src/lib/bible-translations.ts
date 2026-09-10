import type { BibleBook } from './bible-books'

const TRANSLATION_POPUP_WIDTH = 560
const TRANSLATION_POPUP_HEIGHT = 360

export const EXTERNAL_BIBLE_TRANSLATIONS = [
  { id: 313, code: 'BTI', label: 'Перевод Кулакова' },
  { id: 143, code: 'НРП', label: 'Новый русский перевод' },
] as const

export type ExternalBibleTranslation = typeof EXTERNAL_BIBLE_TRANSLATIONS[number]

export function openBibleTranslation(
  book: BibleBook,
  chapter: number,
  verse: number,
  translation: ExternalBibleTranslation,
) {
  const popupLeft = Math.max(0, Math.round(window.screenX + (window.outerWidth - TRANSLATION_POPUP_WIDTH) / 2))
  const popupTop = Math.max(0, Math.round(window.screenY + (window.outerHeight - TRANSLATION_POPUP_HEIGHT) / 2))
  window.open(
    `https://www.bible.com/ru/bible/${translation.id}/${book.youVersionCode}.${chapter}.${verse}.${encodeURIComponent(translation.code)}`,
    '_blank',
    `popup,width=${TRANSLATION_POPUP_WIDTH},height=${TRANSLATION_POPUP_HEIGHT},left=${popupLeft},top=${popupTop},resizable=yes,scrollbars=yes,noopener,noreferrer`,
  )
}
