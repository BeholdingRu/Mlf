import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useData } from '../hooks/useData'
import {
  BIBLE_BOOKS,
  NEW_TESTAMENT,
  OLD_TESTAMENT,
  type BibleBook,
  type BibleNavigationTarget,
} from '../lib/bible-books'
import { EXTERNAL_BIBLE_TRANSLATIONS, openBibleTranslation } from '../lib/bible-translations'
import { BIBLE_GROWTH_STAGE_STEPS, BIBLE_GROWTH_TOTAL_STEPS } from '../lib/bible-growth'
import { daysInclusive, isoDateInTimeZone, millisecondsUntilNextDayInTimeZone, parseISODate } from '../lib/dates'
import type { BibleBookmark, BibleVerse, TorahPortion } from '../lib/types'
import { BibleGrowthVine } from './BibleGrowthVine'

const TORAH_RUSSIAN_PLAYLIST_URL = 'https://youtube.com/playlist?list=PLV034aDASG5T4OizaEyJyzlZV_K8tGZnv&si=1oZmv97ixhOJszK9'
const DEFAULT_BOOKMARK_COLOR = '#fff2a8'
const BIBLE_TREE_TEST_DATE_STORAGE_KEY = 'mlf:bible-tree-test-date'
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
  if (!navigationRequest) return { book: null, chapter: null, verse: null }
  const requestedBook = BIBLE_BOOKS.find((item) => item.order === navigationRequest.bookOrder) ?? null
  const requestedChapter = requestedBook
    && navigationRequest.chapter >= 1
    && navigationRequest.chapter <= requestedBook.chapters
    ? navigationRequest.chapter
    : null
  const requestedVerse = requestedChapter
    && typeof navigationRequest.verse === 'number'
    && navigationRequest.verse > 0
    ? navigationRequest.verse
    : null
  return { book: requestedChapter ? requestedBook : null, chapter: requestedChapter, verse: requestedVerse }
}

export function BibleView({ navigationRequest }: { navigationRequest?: BibleNavigationTarget | null }) {
  const {
    addBibleBookmark,
    adminMode,
    bibleBookmarks,
    bibleTreeProgress,
    deleteBibleBookmark,
    getBibleChapter,
    getTorahPortions,
    profile,
    recordBibleChapterRead,
    refreshBibleTreeProgress,
    saveBibleReadingPosition,
    updateBibleBookmark,
  } = useData()
  const includeTorahPortions = profile?.annual_cycle_enabled ?? false
  const today = isoDateInTimeZone(profile?.time_zone)
  const [requestedNavigation] = useState(() => getRequestedNavigation(navigationRequest))
  const [book, setBook] = useState<BibleBook | null>(requestedNavigation.book)
  const [chapter, setChapter] = useState<number | null>(requestedNavigation.chapter)
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [chapterListOpen, setChapterListOpen] = useState(false)
  const [playlistInfoOpen, setPlaylistInfoOpen] = useState(false)
  const [activeVerseMenu, setActiveVerseMenu] = useState<number | null>(null)
  const [bookmarkFormVerse, setBookmarkFormVerse] = useState<number | null>(null)
  const [bookmarkTitle, setBookmarkTitle] = useState('')
  const [bookmarkColor, setBookmarkColor] = useState(DEFAULT_BOOKMARK_COLOR)
  const [bookmarkBusy, setBookmarkBusy] = useState(false)
  const [bookmarkError, setBookmarkError] = useState<string | null>(null)
  const [testDate, setTestDate] = useState(() => window.sessionStorage.getItem(BIBLE_TREE_TEST_DATE_STORAGE_KEY) ?? today)
  const [highlightedPortion, setHighlightedPortion] = useState<TorahPortion | null>(null)
  const [loadedTorahPortions, setLoadedTorahPortions] = useState<{
    bookOrder: number
    portions: TorahPortion[]
  } | null>(null)
  const chapterHeadingRef = useRef<HTMLDivElement>(null)
  const suppressChapterScrollRef = useRef(false)
  const saveBibleReadingPositionRef = useRef(saveBibleReadingPosition)
  const recordBibleChapterReadRef = useRef(recordBibleChapterRead)
  const refreshBibleTreeProgressRef = useRef(refreshBibleTreeProgress)
  const recordedChapterKeysRef = useRef(new Set<string>())
  const chapterRecordQueueRef = useRef<Promise<void>>(Promise.resolve())
  const chaptersTodayRef = useRef(bibleTreeProgress.chaptersToday)
  const torahPortions = includeTorahPortions && book && loadedTorahPortions?.bookOrder === book.order
    ? loadedTorahPortions.portions
    : []
  const chapterBookmarks = new Map(
    bibleBookmarks
      .filter((bookmark) => bookmark.book_order === book?.order && bookmark.chapter === chapter)
      .map((bookmark) => [bookmark.verse, bookmark]),
  )
  const actualVisibleTreeSteps = Math.min(
    BIBLE_GROWTH_TOTAL_STEPS,
    bibleTreeProgress.progressSteps + (bibleTreeProgress.chaptersToday >= 5 ? 1 : 0),
  )
  const testStartDate = bibleTreeProgress.startedOn ?? today
  const simulatedTreeSteps = testDate && testDate >= testStartDate
    ? Math.min(BIBLE_GROWTH_TOTAL_STEPS, daysInclusive(parseISODate(testStartDate), parseISODate(testDate)))
    : 0
  const visibleTreeSteps = adminMode ? simulatedTreeSteps : actualVisibleTreeSteps
  const vineProgressPercent = Math.min(100, visibleTreeSteps * 0.3)
  const grapeProgressPercent = Math.min(100, Math.max(0, visibleTreeSteps - BIBLE_GROWTH_STAGE_STEPS) * 0.3)
  const trackBibleChapter = useCallback((bookOrder: number, chapterNumber: number) => {
    if (chaptersTodayRef.current >= 5) return
    const chapterKey = `${isoDateInTimeZone(profile?.time_zone)}:${bookOrder}:${chapterNumber}`
    if (recordedChapterKeysRef.current.has(chapterKey)) return
    recordedChapterKeysRef.current.add(chapterKey)
    chapterRecordQueueRef.current = chapterRecordQueueRef.current
      .then(async () => {
        if (chaptersTodayRef.current >= 5) return
        const nextProgress = await recordBibleChapterReadRef.current(bookOrder, chapterNumber)
        if (nextProgress) chaptersTodayRef.current = nextProgress.chaptersToday
      })
      .catch(() => {
        recordedChapterKeysRef.current.delete(chapterKey)
      })
  }, [profile?.time_zone])

  useEffect(() => {
    saveBibleReadingPositionRef.current = saveBibleReadingPosition
  }, [saveBibleReadingPosition])

  useEffect(() => {
    window.sessionStorage.setItem(BIBLE_TREE_TEST_DATE_STORAGE_KEY, testDate)
  }, [testDate])

  useEffect(() => {
    recordBibleChapterReadRef.current = recordBibleChapterRead
  }, [recordBibleChapterRead])

  useEffect(() => {
    refreshBibleTreeProgressRef.current = refreshBibleTreeProgress
  }, [refreshBibleTreeProgress])

  useEffect(() => {
    chaptersTodayRef.current = bibleTreeProgress.chaptersToday
  }, [bibleTreeProgress.chaptersToday])

  useEffect(() => {
    let disposed = false
    let timer: number | undefined
    let observedDate = isoDateInTimeZone(profile?.time_zone)

    const scheduleMidnightCheck = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const currentDate = isoDateInTimeZone(profile?.time_zone)
        if (currentDate !== observedDate) {
          observedDate = currentDate
          void refreshBibleTreeProgressRef.current()
            .catch(() => undefined)
            .finally(() => {
              if (!disposed) scheduleMidnightCheck()
            })
          return
        }
        scheduleMidnightCheck()
      }, millisecondsUntilNextDayInTimeZone(profile?.time_zone))
    }

    const checkDateWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      const currentDate = isoDateInTimeZone(profile?.time_zone)
      if (currentDate === observedDate) return
      observedDate = currentDate
      window.clearTimeout(timer)
      void refreshBibleTreeProgressRef.current()
        .catch(() => undefined)
        .finally(() => {
          if (!disposed) scheduleMidnightCheck()
        })
    }

    scheduleMidnightCheck()
    document.addEventListener('visibilitychange', checkDateWhenVisible)
    return () => {
      disposed = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', checkDateWhenVisible)
    }
  }, [profile?.time_zone])

  useEffect(() => {
    if (activeVerseMenu === null) return

    const closeHint = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.verse-action-control')) {
        setActiveVerseMenu(null)
        setBookmarkFormVerse(null)
      }
    }
    const closeHintOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveVerseMenu(null)
        setBookmarkFormVerse(null)
      }
    }
    window.addEventListener('pointerdown', closeHint)
    window.addEventListener('keydown', closeHintOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeHint)
      window.removeEventListener('keydown', closeHintOnEscape)
    }
  }, [activeVerseMenu])

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
    if (!book || !chapter || verses.length === 0) return

    if (suppressChapterScrollRef.current) {
      suppressChapterScrollRef.current = false
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const requestedVerse = requestedNavigation.book?.order === book?.order
        && requestedNavigation.chapter === chapter
        ? requestedNavigation.verse
        : null
      const verseElement = requestedVerse
        ? document.getElementById(`bible-verse-${book.order}-${chapter}-${requestedVerse}`)
        : null
      if (verseElement) {
        verseElement.scrollIntoView({ block: 'center' })
      } else {
        chapterHeadingRef.current?.scrollIntoView({ block: 'start' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [book, chapter, requestedNavigation, verses])

  useEffect(() => {
    if (!book || !chapter || verses.length === 0) return
    if (verses[0]?.book_order !== book.order || verses[0]?.chapter !== chapter) return
    trackBibleChapter(book.order, chapter)
  }, [book, chapter, trackBibleChapter, verses])

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
    setActiveVerseMenu(null)
    setBookmarkFormVerse(null)
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
    setActiveVerseMenu(null)
    setBookmarkFormVerse(null)
    setVerses([])
    setError(null)
  }

  function selectChapter(nextChapter: number, scrollToChapterHeading = true) {
    setActiveVerseMenu(null)
    setBookmarkFormVerse(null)
    if (nextChapter === chapter) {
      setChapterListOpen((open) => !open)
      return
    }
    suppressChapterScrollRef.current = !scrollToChapterHeading
    trackBibleChapter(book!.order, nextChapter)
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
    openBibleTranslation(book, chapter, verse, translation)
    setActiveVerseMenu(null)
    setBookmarkFormVerse(null)
  }

  function toggleVerseMenu(verse: number) {
    const opening = activeVerseMenu !== verse
    setActiveVerseMenu(opening ? verse : null)
    setBookmarkFormVerse(null)
    setBookmarkError(null)
  }

  function startBookmarkCreation(verse: number) {
    if (!book || !chapter) return
    setBookmarkFormVerse(verse)
    setBookmarkTitle(`${book.name} ${chapter}:${verse}`)
    setBookmarkColor(DEFAULT_BOOKMARK_COLOR)
  }

  function startBookmarkEditing(bookmark: BibleBookmark) {
    setBookmarkFormVerse(bookmark.verse)
    setBookmarkTitle(bookmark.title)
    setBookmarkColor(bookmark.color)
  }

  async function saveBookmark(verse: number, existingBookmark?: BibleBookmark) {
    if (!book || !chapter || !bookmarkTitle.trim() || bookmarkBusy) return
    setBookmarkBusy(true)
    setBookmarkError(null)
    try {
      if (existingBookmark) {
        await updateBibleBookmark(existingBookmark.id, bookmarkTitle, bookmarkColor)
      } else {
        await addBibleBookmark(book.order, chapter, verse, bookmarkTitle, bookmarkColor)
      }
      setActiveVerseMenu(null)
      setBookmarkFormVerse(null)
    } catch (saveError) {
      setBookmarkError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить закладку')
    } finally {
      setBookmarkBusy(false)
    }
  }

  async function removeBookmark(bookmark: BibleBookmark) {
    if (bookmarkBusy) return
    setBookmarkBusy(true)
    setBookmarkError(null)
    try {
      await deleteBibleBookmark(bookmark.id)
      setActiveVerseMenu(null)
      setBookmarkFormVerse(null)
    } catch (deleteError) {
      setBookmarkError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить закладку')
    } finally {
      setBookmarkBusy(false)
    }
  }

  return (
    <section className="bible-view">
      {adminMode && (
        <label className="withdrawal-test-date bible-tree-test-date">
          Тестовая дата
          <input
            type="date"
            value={testDate}
            min={testStartDate}
            onChange={(event) => setTestDate(event.target.value)}
          />
          <span className="hint">
            Лоза и плоды показывают результат так, будто каждый день было прочитано 5 уникальных глав. Данные в БД не сохраняются.
          </span>
        </label>
      )}
      {!book && (
        <div className={vineProgressPercent > 0 ? 'bible-library has-growth-tree' : 'bible-library'} aria-label="Выбор книги Библии">
          <BibleBookGroup title="Свидетельство Иисуса Христа" books={NEW_TESTAMENT} activeBookOrder={profile?.last_bible_book_order} onSelect={selectBook} />
          <BibleGrowthVine progress={vineProgressPercent} grapeProgress={grapeProgressPercent} />
          <BibleBookGroup title="Тора, Писания и Пророки" books={OLD_TESTAMENT} activeBookOrder={profile?.last_bible_book_order} onSelect={selectBook} />
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
                  onClick={() => selectChapter(number, false)}
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
              {bookmarkError && <p className="banner error">{bookmarkError}</p>}
              {error ? <p className="banner error">{error}</p> : verses.length ? (
                <>
                  <div className="bible-verses">
                    {verses.map((verse) => {
                      const bookmark = chapterBookmarks.get(verse.verse)
                      return <Fragment key={verse.verse}>
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
                        <p
                          id={`bible-verse-${book.order}-${chapter}-${verse.verse}`}
                          className={bookmark ? 'bible-verse bookmarked' : 'bible-verse'}
                          style={bookmark ? { '--bookmark-color': bookmark.color } as CSSProperties : undefined}
                        >
                          <span className="verse-action-control">
                            <button
                              type="button"
                              className="verse-action-number"
                              onClick={() => toggleVerseMenu(verse.verse)}
                              aria-label={`Действия со стихом: ${book.name} ${chapter}:${verse.verse}`}
                              aria-expanded={activeVerseMenu === verse.verse}
                            >
                              {verse.verse}
                            </button>
                            {activeVerseMenu === verse.verse && (
                              <span className="verse-actions-menu" aria-label="Действия со стихом">
                                {bookmarkFormVerse === verse.verse ? (
                                  <span className="verse-bookmark-form">
                                    <label>
                                      <span>Название закладки</span>
                                      <input
                                        type="text"
                                        value={bookmarkTitle}
                                        maxLength={160}
                                        disabled={bookmarkBusy}
                                        onChange={(event) => setBookmarkTitle(event.target.value)}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') {
                                            event.preventDefault()
                                            void saveBookmark(verse.verse, bookmark)
                                          }
                                        }}
                                      />
                                    </label>
                                    <label className="verse-bookmark-color-field">
                                      <span>Цвет</span>
                                      <input
                                        type="color"
                                        value={bookmarkColor}
                                        disabled={bookmarkBusy}
                                        aria-label="Цвет закладки"
                                        onChange={(event) => setBookmarkColor(event.target.value)}
                                      />
                                    </label>
                                    <span className="verse-bookmark-form-actions">
                                      <button type="button" disabled={bookmarkBusy || !bookmarkTitle.trim()} onClick={() => void saveBookmark(verse.verse, bookmark)}>
                                        {bookmarkBusy ? 'Сохранение…' : 'Сохранить'}
                                      </button>
                                      <button type="button" disabled={bookmarkBusy} onClick={() => setBookmarkFormVerse(null)}>Отмена</button>
                                    </span>
                                  </span>
                                ) : bookmark ? (
                                  <span className="verse-bookmark-existing-actions">
                                    <button type="button" disabled={bookmarkBusy} onClick={() => startBookmarkEditing(bookmark)}>
                                      Редактировать закладку
                                    </button>
                                    <button
                                      type="button"
                                      className="verse-bookmark-delete-action"
                                      disabled={bookmarkBusy}
                                      onClick={() => void removeBookmark(bookmark)}
                                    >
                                      {bookmarkBusy ? 'Удаление…' : 'Удалить закладку'}
                                    </button>
                                  </span>
                                ) : (
                                  <button type="button" onClick={() => startBookmarkCreation(verse.verse)}>
                                    Добавить закладку
                                  </button>
                                )}
                                {bookmarkFormVerse !== verse.verse && (
                                  <span className="verse-translation-links" aria-label="Выбор перевода">
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
                    })}
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
            <span className="bible-book-label">{book.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
