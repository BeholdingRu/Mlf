import { useEffect, useState, type CSSProperties } from 'react'
import { useData } from '../hooks/useData'
import { BIBLE_BOOKS, type BibleNavigationTarget } from '../lib/bible-books'
import { EXTERNAL_BIBLE_TRANSLATIONS, openBibleTranslation } from '../lib/bible-translations'
import type { BibleBookmark } from '../lib/types'

export function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg className="bookmark-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3.75h10a1.25 1.25 0 0 1 1.25 1.25v15.1L12 16.2l-6.25 3.9V5A1.25 1.25 0 0 1 7 3.75Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BibleBookmarksView({ onOpen }: { onOpen: (target: BibleNavigationTarget) => void }) {
  const { bibleBookmarks, deleteBibleBookmark, getBibleChapter, updateBibleBookmark } = useData()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingBookmark, setEditingBookmark] = useState<BibleBookmark | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editColor, setEditColor] = useState('#fff2a8')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedBookmarkId, setExpandedBookmarkId] = useState<string | null>(null)
  const [loadingVerseId, setLoadingVerseId] = useState<string | null>(null)
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({})
  const [verseErrors, setVerseErrors] = useState<Record<string, string>>({})
  const [activeTranslationBookmarkId, setActiveTranslationBookmarkId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeTranslationBookmarkId) return

    const closeMenu = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.bible-bookmark-verse-action')) {
        setActiveTranslationBookmarkId(null)
      }
    }
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveTranslationBookmarkId(null)
    }
    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', closeMenuOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', closeMenuOnEscape)
    }
  }, [activeTranslationBookmarkId])

  async function toggleVerseText(bookmark: BibleBookmark) {
    if (expandedBookmarkId === bookmark.id) {
      setExpandedBookmarkId(null)
      setActiveTranslationBookmarkId(null)
      return
    }

    setExpandedBookmarkId(bookmark.id)
    setActiveTranslationBookmarkId(null)
    if (verseTexts[bookmark.id] || loadingVerseId === bookmark.id) return

    setLoadingVerseId(bookmark.id)
    setVerseErrors((current) => {
      const next = { ...current }
      delete next[bookmark.id]
      return next
    })
    try {
      const verses = await getBibleChapter(bookmark.book_order, bookmark.chapter)
      const selectedVerse = verses.find((verse) => verse.verse === bookmark.verse)
      if (!selectedVerse) throw new Error('Текст этого стиха не найден')
      setVerseTexts((current) => ({ ...current, [bookmark.id]: selectedVerse.text }))
    } catch (loadError) {
      setVerseErrors((current) => ({
        ...current,
        [bookmark.id]: loadError instanceof Error ? loadError.message : 'Не удалось загрузить текст стиха',
      }))
    } finally {
      setLoadingVerseId((current) => current === bookmark.id ? null : current)
    }
  }

  function startEditing(bookmark: BibleBookmark) {
    setEditingBookmark(bookmark)
    setEditTitle(bookmark.title)
    setEditColor(bookmark.color)
    setError(null)
  }

  async function saveBookmarkChanges() {
    if (!editingBookmark || !editTitle.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await updateBibleBookmark(editingBookmark.id, editTitle, editColor)
      setEditingBookmark(null)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Не удалось изменить закладку')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBookmark(bookmark: BibleBookmark) {
    if (deletingId || !window.confirm(`Удалить закладку «${bookmark.title}»?`)) return
    setDeletingId(bookmark.id)
    setError(null)
    try {
      await deleteBibleBookmark(bookmark.id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить закладку')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="bible-bookmarks-view">
      <div className="bible-bookmarks-heading">
        <BookmarkIcon filled />
        <div>
          <h2>Закладки</h2>
          <p>Нажмите на закладку, чтобы показать текст сохранённого стиха.</p>
        </div>
      </div>

      {error && <p className="banner error">{error}</p>}
      {bibleBookmarks.length === 0 ? (
        <p className="empty">В Библии пока нет закладок.</p>
      ) : (
        <div className="bible-bookmarks-list">
          {bibleBookmarks.map((bookmark) => {
            const book = BIBLE_BOOKS.find((item) => item.order === bookmark.book_order)
            const reference = `${book?.name ?? `Книга ${bookmark.book_order}`} ${bookmark.chapter}:${bookmark.verse}`
            const isExpanded = expandedBookmarkId === bookmark.id
            return (
              <article
                key={bookmark.id}
                className="bible-bookmark-card"
                style={{ '--bookmark-color': bookmark.color } as CSSProperties}
              >
                <button
                  type="button"
                  className="bible-bookmark-open"
                  aria-expanded={isExpanded}
                  aria-controls={`bible-bookmark-verse-${bookmark.id}`}
                  onClick={() => void toggleVerseText(bookmark)}
                >
                  <strong>{bookmark.title}</strong>
                  <span>{reference}</span>
                </button>
                <div className="bible-bookmark-actions">
                  <button
                    type="button"
                    className="bible-bookmark-go-to"
                    aria-label={`Перейти к стиху ${reference}`}
                    title="Перейти к стиху"
                    onClick={() => onOpen({
                      bookOrder: bookmark.book_order,
                      chapter: bookmark.chapter,
                      verse: bookmark.verse,
                      requestId: Date.now(),
                    })}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className="edit-button"
                    aria-label={`Редактировать закладку «${bookmark.title}»`}
                    title="Редактировать закладку"
                    disabled={deletingId !== null}
                    onClick={() => startEditing(bookmark)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="delete-button"
                    aria-label={`Удалить закладку «${bookmark.title}»`}
                    title="Удалить закладку"
                    disabled={deletingId !== null}
                    onClick={() => void deleteBookmark(bookmark)}
                  >
                    {deletingId === bookmark.id ? '…' : '×'}
                  </button>
                </div>
                {isExpanded && (
                  <div
                    id={`bible-bookmark-verse-${bookmark.id}`}
                    className="bible-bookmark-verse-text"
                    aria-live="polite"
                  >
                    {loadingVerseId === bookmark.id ? (
                      <span className="muted">Загрузка стиха…</span>
                    ) : verseErrors[bookmark.id] ? (
                      <span className="error-text">{verseErrors[bookmark.id]}</span>
                    ) : (
                      <p>
                        <span className="verse-action-control bible-bookmark-verse-action">
                          <button
                            type="button"
                            className="verse-action-number"
                            aria-label={`Выбрать перевод для стиха ${reference}`}
                            aria-expanded={activeTranslationBookmarkId === bookmark.id}
                            onClick={() => setActiveTranslationBookmarkId((current) => current === bookmark.id ? null : bookmark.id)}
                          >
                            {bookmark.verse}
                          </button>
                          {activeTranslationBookmarkId === bookmark.id && (
                            <span className="verse-actions-menu" aria-label="Выбор перевода">
                              {EXTERNAL_BIBLE_TRANSLATIONS.map((translation) => (
                                <button
                                  key={translation.code}
                                  type="button"
                                  onClick={() => {
                                    if (book) openBibleTranslation(book, bookmark.chapter, bookmark.verse, translation)
                                    setActiveTranslationBookmarkId(null)
                                  }}
                                >
                                  {translation.label}
                                </button>
                              ))}
                            </span>
                          )}
                        </span>
                        {verseTexts[bookmark.id]}
                      </p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {editingBookmark && (
        <div className="modal-overlay" role="presentation" onClick={() => !saving && setEditingBookmark(null)}>
          <form
            className="modal-content bible-bookmark-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-bible-bookmark-title"
            onSubmit={(event) => { event.preventDefault(); void saveBookmarkChanges() }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="edit-bible-bookmark-title">Редактировать закладку</h3>
            <label className="form-group">
              <span>Название закладки</span>
              <input
                type="text"
                value={editTitle}
                maxLength={160}
                disabled={saving}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </label>
            <label className="bible-bookmark-edit-color">
              <span>Цвет закладки</span>
              <input
                type="color"
                value={editColor}
                disabled={saving}
                aria-label="Цвет закладки"
                onChange={(event) => setEditColor(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button type="submit" className="save-button" disabled={saving || !editTitle.trim()}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button type="button" className="cancel-button" disabled={saving} onClick={() => setEditingBookmark(null)}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
