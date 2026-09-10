import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useData } from '../hooks/useData'
import {
  BIBLE_BOOKS,
  NEW_TESTAMENT,
  OLD_TESTAMENT,
  type BibleBook,
  type BibleNavigationTarget,
} from '../lib/bible-books'
import type { BibleVerse, TorahPortion } from '../lib/types'

const TORAH_RUSSIAN_PLAYLIST_URL = 'https://youtube.com/playlist?list=PLV034aDASG5T4OizaEyJyzlZV_K8tGZnv&si=1oZmv97ixhOJszK9'
const TRANSLATION_POPUP_WIDTH = 560
const TRANSLATION_POPUP_HEIGHT = 360
const EXTERNAL_BIBLE_TRANSLATIONS = [
  { id: 313, code: 'BTI', label: 'Перевод Кулакова' },
  { id: 143, code: 'НРП', label: 'Новый русский перевод' },
] as const
const chapterCache = new Map<string, BibleVerse[]>()
const pendingChapters = new Map<string, Promise<BibleVerse[]>>()
const torahPortionsCache = new Map<number, TorahPortion[]>()

function getChapterKey(bookOrder: number, chapterNumber: number, includeTorahPortions: boolean) {
  return `${includeTorahPortions ? 'annual' : 'plain'}:${bookOrder}:${chapterNumber}`
}

function getPortionColorStyle(portionNumber?: number | null): CSSProperties {
  const hue = portionNumber ? Math.round(((portionNumber - 1) * 137.508) % 360) : 120
  return { '--portion-color': `hsl(${hue} 62% 45%)` } as CSSProperties
}

function getRequestedNavigation(navigationRequest?: BibleNavigationTarget | null) {
  if (!navigationRequest) return { book: null, chapter: null }
  const requestedBook = BIBLE_BOOKS.find((item) => item.order === navigationRequest.bookOrder) ?? null
  const requestedChapter = requestedBook
    && navigationRequest.chapter >= 1
    && navigationRequest.chapter <= requestedBook.chapters
    ? navigationRequest.chapter
    : null
  return { book: requestedChapter ? requestedBook : null, chapter: requestedChapter }
}

export function BibleView({ navigationRequest }: { navigationRequest?: BibleNavigationTarget | null }) {
  const { getBibleChapter, getTorahPortions, profile, saveBibleReadingPosition } = useData()
  const includeTorahPortions = profile?.annual_cycle_enabled ?? false
  const [requestedNavigation] = useState(() => getRequestedNavigation(navigationRequest))
  const [book, setBook] = useState<BibleBook | null>(requestedNavigation.book)
  const [chapter, setChapter] = useState<number | null>(requestedNavigation.chapter)
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [chapterListOpen, setChapterListOpen] = useState(false)
  const [playlistInfoOpen, setPlaylistInfoOpen] = useState(false)
  const [activeTranslationVerse, setActiveTranslationVerse] = useState<number | null>(null)
  const [highlightedPortion, setHighlightedPortion] = useState<TorahPortion | null>(null)
  const [loadedTorahPortions, setLoadedTorahPortions] = useState<{
    bookOrder: number
    portions: TorahPortion[]
  } | null>(null)
  const chapterHeadingRef = useRef<HTMLDivElement>(null)
  const saveBibleReadingPositionRef = useRef(saveBibleReadingPosition)
  const torahPortions = includeTorahPortions && book && loadedTorahPortions?.bookOrder === book.order
    ? loadedTorahPortions.portions
    : []

  useEffect(() => {
    saveBibleReadingPositionRef.current = saveBibleReadingPosition
  }, [saveBibleReadingPosition])

  useEffect(() => {
    if (activeTranslationVerse === null) return

    const closeHint = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.verse-translation-control')) setActiveTranslationVerse(null)
    }
    const closeHintOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveTranslationVerse(null)
    }
    window.addEventListener('pointerdown', closeHint)
    window.addEventListener('keydown', closeHintOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeHint)
      window.removeEventListener('keydown', closeHintOnEscape)
    }
  }, [activeTranslationVerse])

  useEffect(() => {
    if (!requestedNavigation.book || !requestedNavigation.chapter) return
    void saveBibleReadingPositionRef.current(requestedNavigation.book.order, requestedNavigation.chapter)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось сохранить место чтения'))
  }, [requestedNavigation])

  const loadChapter = useCallback((bookOrder: number, chapterNumber: number) => {
    const key = getChapterKey(bookOrder, chapterNumber, includeTorahPortions)
    const cached = chapterCache.get(key)
    if (cached) return Promise.resolve(cached)

    const pending = pendingChapters.get(key)
    if (pending) return pending

    const request = getBibleChapter(bookOrder, chapterNumber, includeTorahPortions)
      .then((result) => {
        chapterCache.set(key, result)
        return result
      })
      .finally(() => pendingChapters.delete(key))
    pendingChapters.set(key, request)
    return request
  }, [getBibleChapter, includeTorahPortions])

  useEffect(() => {
    if (!book || !chapter) return

    let cancelled = false
    loadChapter(book.order, chapter)
      .then((result) => {
        if (!cancelled) {
          setVerses(result)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить текст главы')
      })

    return () => { cancelled = true }
  }, [book, chapter, loadChapter])

  useEffect(() => {
    if (!book || !chapter) return

    const adjacentChapters = [chapter - 1, chapter + 1]
      .filter((chapterNumber) => chapterNumber >= 1 && chapterNumber <= book.chapters)
    for (const chapterNumber of adjacentChapters) {
      void loadChapter(book.order, chapterNumber).catch(() => undefined)
    }
  }, [book, chapter, loadChapter])

  useEffect(() => {
    if (!includeTorahPortions || !book || book.order > 5) return

    const cached = torahPortionsCache.get(book.order)
    let cancelled = false
    const request = cached ? Promise.resolve(cached) : getTorahPortions(book.order)
    request
      .then((portions) => {
        torahPortionsCache.set(book.order, portions)
        if (!cancelled) setLoadedTorahPortions({ bookOrder: book.order, portions })
      })
      .catch(() => undefined)

    return () => { cancelled = true }
  }, [book, getTorahPortions, includeTorahPortions])

  useEffect(() => {
    if (!chapter || verses.length === 0) return

    const frame = window.requestAnimationFrame(() => {
      chapterHeadingRef.current?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [book?.order, chapter, verses])

  function selectBook(nextBook: BibleBook) {
    const savedChapter = profile?.last_bible_book_order === nextBook.order
      && profile.last_bible_chapter
      && profile.last_bible_chapter <= nextBook.chapters
      ? profile.last_bible_chapter
      : null
    setBook(nextBook)
    setChapter(savedChapter)
    setChapterListOpen(false)
    setPlaylistInfoOpen(false)
    setActiveTranslationVerse(null)
    setVerses(savedChapter
      ? chapterCache.get(getChapterKey(nextBook.order, savedChapter, includeTorahPortions)) ?? []
      : [])
    setError(null)
  }

  function returnToLibrary() {
    setBook(null)
    setChapter(null)
    setChapterListOpen(false)
    setPlaylistInfoOpen(false)
    setActiveTranslationVerse(null)
    setVerses([])
    setError(null)
  }

  function selectChapter(nextChapter: number) {
    setActiveTranslationVerse(null)
    if (nextChapter === chapter) {
      setChapterListOpen((open) => !open)
      return
    }
    setChapter(nextChapter)
    setChapterListOpen(false)
    const cached = chapterCache.get(getChapterKey(book!.order, nextChapter, includeTorahPortions))
    setVerses(cached ?? [])
    setError(null)
    void saveBibleReadingPosition(book!.order, nextChapter)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось сохранить место чтения'))
  }

  function openExternalBibleVerse(verse: number, translation: typeof EXTERNAL_BIBLE_TRANSLATIONS[number]) {
    if (!book || !chapter) return
    const popupLeft = Math.max(0, Math.round(window.screenX + (window.outerWidth - TRANSLATION_POPUP_WIDTH) / 2))
    const popupTop = Math.max(0, Math.round(window.screenY + (window.outerHeight - TRANSLATION_POPUP_HEIGHT) / 2))
    window.open(
      `https://www.bible.com/ru/bible/${translation.id}/${book.youVersionCode}.${chapter}.${verse}.${encodeURIComponent(translation.code)}`,
      '_blank',
      `popup,width=${TRANSLATION_POPUP_WIDTH},height=${TRANSLATION_POPUP_HEIGHT},left=${popupLeft},top=${popupTop},resizable=yes,scrollbars=yes,noopener,noreferrer`,
    )
    setActiveTranslationVerse(null)
  }

  return (
    <section className="bible-view">
      {!book && (
        <div className="bible-library" aria-label="Выбор книги Библии">
          <BibleBookGroup title="Тора, Писания и Пророки" books={OLD_TESTAMENT} activeBookOrder={profile?.last_bible_book_order} onSelect={selectBook} />
          <BibleBookGroup title="Свидетельство Иисуса Христа" books={NEW_TESTAMENT} activeBookOrder={profile?.last_bible_book_order} onSelect={selectBook} />
        </div>
      )}

      {book && (
        <div className="bible-reader">
          <div className="bible-reader-heading">
            <div className="bible-reader-title">
              <h2>{book.name}</h2>
              {includeTorahPortions && book.order <= 5 && (
                <div className="torah-playlist-info-wrap">
                  <button
                    type="button"
                    className="info-button"
                    aria-label="Информация о недельных главах"
                    aria-expanded={playlistInfoOpen}
                    aria-controls="torah-playlist-info"
                    onClick={() => setPlaylistInfoOpen((open) => !open)}
                  >
                    i
                  </button>
                  {playlistInfoOpen && (
                    <p id="torah-playlist-info" className="torah-playlist-info">
                      <a href={TORAH_RUSSIAN_PLAYLIST_URL} target="_blank" rel="noreferrer">здесь</a>{' '}
                      можно посмотреть все недельные главы на русском
                    </p>
                  )}
                </div>
              )}
            </div>
            <button type="button" className="bible-return-button" onClick={returnToLibrary}>Все книги</button>
          </div>
          <div className={chapter && !chapterListOpen ? 'bible-chapters chapter-selected' : 'bible-chapters'} aria-label={`Главы книги «${book.name}»`}>
            {Array.from({ length: book.chapters }, (_, index) => index + 1).map((number) => {
              const highlighted = Boolean(
                highlightedPortion
                && number >= highlightedPortion.start_chapter
                && number <= highlightedPortion.end_chapter,
              )
              const classes = [
                'bible-chapter',
                chapter === number ? 'active' : '',
                highlighted ? 'portion-highlighted' : '',
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={number}
                  type="button"
                  className={classes}
                  style={highlighted ? getPortionColorStyle(highlightedPortion?.portion_number) : undefined}
                  onClick={() => selectChapter(number)}
                  aria-expanded={chapter === number ? chapterListOpen : undefined}
                >
                  {number}
                </button>
              )
            })}
          </div>
          {includeTorahPortions && torahPortions.length > 0 && (
            <div className="torah-portions-map" aria-label={`Недельные главы книги «${book.name}»`}>
              {torahPortions.map((portion) => (
                <button
                  key={portion.id}
                  type="button"
                  className="torah-portion-card"
                  style={getPortionColorStyle(portion.portion_number)}
                  onClick={() => selectChapter(portion.start_chapter)}
                  onMouseEnter={() => setHighlightedPortion(portion)}
                  onMouseLeave={() => setHighlightedPortion(null)}
                  onFocus={() => setHighlightedPortion(portion)}
                  onBlur={() => setHighlightedPortion(null)}
                  title={`Перейти к началу: ${portion.start_chapter}:${portion.start_verse}`}
                >
                  <span className="torah-portion-card-number">{portion.portion_number}</span>
                  <span className="torah-portion-card-names">
                    <strong>{portion.name_ru}</strong>
                    <span><span lang="he" dir="rtl">{portion.name_he}</span> · {portion.name_en}</span>
                  </span>
                  <span className="torah-portion-card-range">
                    {portion.start_chapter}:{portion.start_verse}–{portion.end_chapter}:{portion.end_verse}
                  </span>
                </button>
              ))}
            </div>
          )}
          {chapter && (
            <div className="bible-chapter-text" aria-live="polite">
              <div ref={chapterHeadingRef} className="bible-chapter-heading">
                <h3>{book.name}, глава {chapter}</h3>
                <ChapterNavigation book={book} chapter={chapter} onSelect={selectChapter} />
              </div>
              {error ? <p className="banner error">{error}</p> : verses.length ? (
                <>
                  <div className="bible-verses">
                    {verses.map((verse) => (
                      <Fragment key={verse.verse}>
                        {includeTorahPortions && verse.start_portion_id && (
                          <div
                            className="torah-portion-marker torah-portion-start"
                            style={getPortionColorStyle(verse.start_portion_number)}
                          >
                            <span className="torah-portion-number">Недельная глава {verse.start_portion_number}</span>
                            <strong>{verse.start_portion_name_ru}</strong>
                            <span lang="he" dir="rtl">{verse.start_portion_name_he}</span>
                            <span>{verse.start_portion_name_en}</span>
                            <small>
                              {verse.start_portion_chapter}:{verse.start_portion_verse}–{verse.start_portion_end_chapter}:{verse.start_portion_end_verse}
                            </small>
                          </div>
                        )}
                        <p>
                          <sup className="verse-mobile-number">{verse.verse}</sup>
                          <span className="verse-translation-control">
                            <button
                              type="button"
                              className="verse-translation-number"
                              onClick={() => setActiveTranslationVerse((current) => current === verse.verse ? null : verse.verse)}
                              aria-label={`Показать переводы: ${book.name} ${chapter}:${verse.verse}`}
                              aria-expanded={activeTranslationVerse === verse.verse}
                            >
                              {verse.verse}
                            </button>
                            {activeTranslationVerse === verse.verse && (
                              <span className="verse-translation-menu" aria-label="Выбор перевода">
                                {EXTERNAL_BIBLE_TRANSLATIONS.map((translation) => (
                                  <button
                                    key={translation.code}
                                    type="button"
                                    onClick={() => openExternalBibleVerse(verse.verse, translation)}
                                  >
                                    {translation.label}
                                  </button>
                                ))}
                              </span>
                            )}
                          </span>
                          {verse.text}
                        </p>
                        {includeTorahPortions && verse.end_portion_id && (
                          <div
                            className="torah-portion-marker torah-portion-end"
                            style={getPortionColorStyle(verse.end_portion_number)}
                          >
                            Конец недельной главы «{verse.end_portion_name_ru}»
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                  <ChapterNavigation book={book} chapter={chapter} onSelect={selectChapter} />
                </>
              ) : <p className="muted">Загрузка текста главы…</p>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ChapterNavigation({ book, chapter, onSelect }: { book: BibleBook; chapter: number; onSelect: (chapter: number) => void }) {
  return (
    <div className="bible-chapter-navigation" aria-label="Переход между главами">
      <button type="button" className="bible-arrow-button" disabled={chapter === 1} onClick={() => onSelect(chapter - 1)} aria-label="Предыдущая глава" title="Предыдущая глава">←</button>
      <button type="button" className="bible-arrow-button" disabled={chapter === book.chapters} onClick={() => onSelect(chapter + 1)} aria-label="Следующая глава" title="Следующая глава">→</button>
    </div>
  )
}

function BibleBookGroup({
  title,
  books,
  activeBookOrder,
  onSelect,
}: {
  title: string
  books: BibleBook[]
  activeBookOrder?: number | null
  onSelect: (book: BibleBook) => void
}) {
  return (
    <section className="bible-book-group">
      <h2>{title}</h2>
      <div className="bible-books">
        {books.map((book) => (
          <button
            key={book.order}
            type="button"
            className={activeBookOrder === book.order ? 'bible-book active' : 'bible-book'}
            onClick={() => onSelect(book)}
            aria-current={activeBookOrder === book.order ? 'true' : undefined}
          >
            {book.name}
          </button>
        ))}
      </div>
    </section>
  )
}
