import { useCallback, useEffect, useState } from 'react'
import { useData } from '../hooks/useData'
import type { BibleVerse } from '../lib/types'

type BibleBook = {
  order: number
  name: string
  chapters: number
}

const OLD_TESTAMENT: BibleBook[] = [
  ['Бытие', 50], ['Исход', 40], ['Левит', 27], ['Числа', 36], ['Второзаконие', 34],
  ['Иисус Навин', 24], ['Судьи', 21], ['Руфь', 4], ['1 Царств', 31], ['2 Царств', 24],
  ['3 Царств', 22], ['4 Царств', 25], ['1 Паралипоменон', 29], ['2 Паралипоменон', 36], ['Ездра', 10],
  ['Неемия', 13], ['Есфирь', 10], ['Иов', 42], ['Псалтирь', 150], ['Притчи', 31],
  ['Екклесиаст', 12], ['Песня Песней', 8], ['Исаия', 66], ['Иеремия', 52], ['Плач Иеремии', 5],
  ['Иезекииль', 48], ['Даниил', 12], ['Осия', 14], ['Иоиль', 3], ['Амос', 9],
  ['Авдий', 1], ['Иона', 4], ['Михей', 7], ['Наум', 3], ['Аввакум', 3],
  ['Софония', 3], ['Аггей', 2], ['Захария', 14], ['Малахия', 4],
].map(([name, chapters], index) => ({ order: index + 1, name: name as string, chapters: chapters as number }))

const NEW_TESTAMENT: BibleBook[] = [
  ['От Матфея', 28], ['От Марка', 16], ['От Луки', 24], ['От Иоанна', 21], ['Деяния святых Апостолов', 28],
  ['Послание к Римлянам', 16], ['Первое послание к Коринфянам', 16], ['Второе послание к Коринфянам', 13],
  ['Послание к Галатам', 6], ['Послание к Ефесянам', 6], ['Послание к Филиппийцам', 4], ['Послание к Колоссянам', 4], ['Первое послание к Фессалоникийцам', 5],
  ['Второе послание к Фессалоникийцам', 3], ['Первое послание к Тимофею', 6], ['Второе послание к Тимофею', 4], ['Послание к Титу', 3], ['Послание к Филимону', 1],
  ['Послание к Евреям', 13], ['Послание Иакова', 5], ['Первое послание Петра', 5], ['Второе послание Петра', 3], ['Первое послание Иоанна', 5],
  ['Второе послание Иоанна', 1], ['Третье послание Иоанна', 1], ['Послание Иуды', 1], ['Откровение Иоанна Богослова', 22],
].map(([name, chapters], index) => ({ order: index + 40, name: name as string, chapters: chapters as number }))

const BIBLE_NAVIGATION_STORAGE_KEY = 'mlf:bible-navigation'
const BIBLE_BOOKS = [...OLD_TESTAMENT, ...NEW_TESTAMENT]
const chapterCache = new Map<string, BibleVerse[]>()
const pendingChapters = new Map<string, Promise<BibleVerse[]>>()

function getChapterKey(bookOrder: number, chapterNumber: number) {
  return `${bookOrder}:${chapterNumber}`
}

function getSavedBibleNavigation(): { book: BibleBook | null; chapter: number | null } {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(BIBLE_NAVIGATION_STORAGE_KEY) ?? '{}') as {
      bookOrder?: unknown
      chapter?: unknown
    }
    const book = typeof saved.bookOrder === 'number'
      ? BIBLE_BOOKS.find((item) => item.order === saved.bookOrder) ?? null
      : null
    const chapter = book && typeof saved.chapter === 'number' && saved.chapter >= 1 && saved.chapter <= book.chapters
      ? saved.chapter
      : null
    return { book, chapter }
  } catch {
    window.sessionStorage.removeItem(BIBLE_NAVIGATION_STORAGE_KEY)
    return { book: null, chapter: null }
  }
}

export function BibleView() {
  const { getBibleChapter } = useData()
  const [savedNavigation] = useState(getSavedBibleNavigation)
  const [book, setBook] = useState<BibleBook | null>(savedNavigation.book)
  const [chapter, setChapter] = useState<number | null>(savedNavigation.chapter)
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [chapterListOpen, setChapterListOpen] = useState(false)

  const loadChapter = useCallback((bookOrder: number, chapterNumber: number) => {
    const key = getChapterKey(bookOrder, chapterNumber)
    const cached = chapterCache.get(key)
    if (cached) return Promise.resolve(cached)

    const pending = pendingChapters.get(key)
    if (pending) return pending

    const request = getBibleChapter(bookOrder, chapterNumber)
      .then((result) => {
        chapterCache.set(key, result)
        return result
      })
      .finally(() => pendingChapters.delete(key))
    pendingChapters.set(key, request)
    return request
  }, [getBibleChapter])

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
    if (!book) return
    window.sessionStorage.setItem(BIBLE_NAVIGATION_STORAGE_KEY, JSON.stringify({ bookOrder: book.order, chapter }))
  }, [book, chapter])

  function selectBook(nextBook: BibleBook) {
    setBook(nextBook)
    setChapter(null)
    setChapterListOpen(false)
    setVerses([])
    setError(null)
  }

  function returnToLibrary() {
    setBook(null)
    setChapter(null)
    setChapterListOpen(false)
    setVerses([])
    setError(null)
    window.sessionStorage.removeItem(BIBLE_NAVIGATION_STORAGE_KEY)
  }

  function selectChapter(nextChapter: number) {
    if (nextChapter === chapter) {
      setChapterListOpen((open) => !open)
      return
    }
    setChapter(nextChapter)
    setChapterListOpen(false)
    const cached = chapterCache.get(getChapterKey(book!.order, nextChapter))
    setVerses(cached ?? [])
    setError(null)
  }

  return (
    <section className="bible-view">
      {!book && (
        <div className="bible-library" aria-label="Выбор книги Библии">
          <BibleBookGroup title="Тора, Писания и Пророки" books={OLD_TESTAMENT} onSelect={selectBook} />
          <BibleBookGroup title="Свидетельство Иисуса Христа" books={NEW_TESTAMENT} onSelect={selectBook} />
        </div>
      )}

      {book && (
        <div className="bible-reader">
          <div className="bible-reader-heading">
            <h2>{book.name}</h2>
            <button type="button" className="bible-return-button" onClick={returnToLibrary}>Все книги</button>
          </div>
          <div className={chapter && !chapterListOpen ? 'bible-chapters chapter-selected' : 'bible-chapters'} aria-label={`Главы книги «${book.name}»`}>
            {Array.from({ length: book.chapters }, (_, index) => index + 1).map((number) => (
              <button key={number} type="button" className={chapter === number ? 'bible-chapter active' : 'bible-chapter'} onClick={() => selectChapter(number)} aria-expanded={chapter === number ? chapterListOpen : undefined}>
                {number}
              </button>
            ))}
          </div>
          {chapter && (
            <div className="bible-chapter-text" aria-live="polite">
              <div className="bible-chapter-heading">
                <h3>{book.name}, глава {chapter}</h3>
                <ChapterNavigation book={book} chapter={chapter} onSelect={selectChapter} />
              </div>
              {error ? <p className="banner error">{error}</p> : verses.length ? (
                <>
                  <div className="bible-verses">
                    {verses.map((verse) => <p key={verse.verse}><sup>{verse.verse}</sup>{verse.text}</p>)}
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

function BibleBookGroup({ title, books, onSelect }: { title: string; books: BibleBook[]; onSelect: (book: BibleBook) => void }) {
  return (
    <section className="bible-book-group">
      <h2>{title}</h2>
      <div className="bible-books">
        {books.map((book) => <button key={book.order} type="button" className="bible-book" onClick={() => onSelect(book)}>{book.name}</button>)}
      </div>
    </section>
  )
}
