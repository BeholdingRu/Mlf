const BIBLE_DAILY_READING_STORAGE_PREFIX = 'mlf:bible-daily-reading:'
const BIBLE_DAILY_READING_STORAGE_VERSION = 1
const MAX_SERVER_CHAPTERS_PER_DAY = 5

export const BIBLE_DAILY_READING_EVENT = 'mlf:bible-daily-reading-change'

export type BibleDailyReadingEventDetail = {
  userId: string
  date: string
  count: number
}

export type BibleDailyReadingChapter = {
  bookOrder: number
  chapter: number
}

type StoredBibleDailyReading = {
  version: number
  userId: string
  date: string
  serverCount: number
  chapters: string[]
}

function storageKey(userId: string, date: string) {
  return `${BIBLE_DAILY_READING_STORAGE_PREFIX}${userId}:${date}`
}

function chapterKey(bookOrder: number, chapter: number) {
  return `${bookOrder}:${chapter}`
}

function normalizeServerCount(value: unknown) {
  const count = Number(value)
  if (!Number.isFinite(count)) return 0
  return Math.max(0, Math.min(MAX_SERVER_CHAPTERS_PER_DAY, Math.floor(count)))
}

function normalizeChapterKey(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^(\d+):(\d+)$/.exec(value)
  if (!match) return null
  const bookOrder = Number(match[1])
  const chapter = Number(match[2])
  if (!Number.isInteger(bookOrder) || bookOrder < 1 || bookOrder > 66) return null
  if (!Number.isInteger(chapter) || chapter < 1) return null
  return chapterKey(bookOrder, chapter)
}

function emptyReading(userId: string, date: string): StoredBibleDailyReading {
  return {
    version: BIBLE_DAILY_READING_STORAGE_VERSION,
    userId,
    date,
    serverCount: 0,
    chapters: [],
  }
}

function parseReading(
  value: string | null,
  userId: string,
  date: string,
): StoredBibleDailyReading {
  if (!value) return emptyReading(userId, date)

  try {
    const parsed = JSON.parse(value) as Partial<StoredBibleDailyReading>
    if (parsed.userId !== userId || parsed.date !== date) return emptyReading(userId, date)
    const chapters = Array.from(new Set(
      Array.isArray(parsed.chapters)
        ? parsed.chapters.map(normalizeChapterKey).filter((key): key is string => key !== null)
        : [],
    ))
    return {
      version: BIBLE_DAILY_READING_STORAGE_VERSION,
      userId,
      date,
      serverCount: normalizeServerCount(parsed.serverCount),
      chapters,
    }
  } catch {
    return emptyReading(userId, date)
  }
}

function readReading(userId: string, date: string) {
  if (typeof window === 'undefined') return emptyReading(userId, date)
  try {
    return parseReading(window.localStorage.getItem(storageKey(userId, date)), userId, date)
  } catch {
    return emptyReading(userId, date)
  }
}

function readingCount(reading: StoredBibleDailyReading) {
  return Math.max(reading.serverCount, reading.chapters.length)
}

function emitReadingChange(reading: StoredBibleDailyReading) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<BibleDailyReadingEventDetail>(BIBLE_DAILY_READING_EVENT, {
    detail: {
      userId: reading.userId,
      date: reading.date,
      count: readingCount(reading),
    },
  }))
}

function writeReading(reading: StoredBibleDailyReading) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(reading.userId, reading.date), JSON.stringify(reading))
  } catch {
    // The in-memory caller can continue even when browser storage is unavailable.
  }
  emitReadingChange(reading)
}

export function getBibleDailyReadingCount(userId: string, date: string) {
  if (!userId || !date) return 0
  return readingCount(readReading(userId, date))
}

export function recordLocalBibleChapter(
  userId: string,
  date: string,
  bookOrder: number,
  chapter: number,
  seedCount = 0,
) {
  if (!userId || !date) return 0
  const key = normalizeChapterKey(chapterKey(bookOrder, chapter))
  if (!key) return getBibleDailyReadingCount(userId, date)

  const reading = readReading(userId, date)
  const previousServerCount = reading.serverCount
  const chapters = new Set(reading.chapters)
  const alreadyRecorded = chapters.has(key)
  chapters.add(key)
  reading.chapters = Array.from(chapters)
  reading.serverCount = Math.max(reading.serverCount, normalizeServerCount(seedCount))

  const nextCount = readingCount(reading)
  if (!alreadyRecorded || reading.serverCount !== previousServerCount) {
    writeReading(reading)
  }
  return nextCount
}

export function seedBibleDailyReadingChapters(
  userId: string,
  date: string,
  chapters: Iterable<BibleDailyReadingChapter | string>,
) {
  if (!userId || !date) return 0
  const reading = readReading(userId, date)
  const mergedChapters = new Set(reading.chapters)

  for (const chapter of chapters) {
    const key = typeof chapter === 'string'
      ? normalizeChapterKey(chapter)
      : normalizeChapterKey(chapterKey(chapter.bookOrder, chapter.chapter))
    if (key) mergedChapters.add(key)
  }

  if (mergedChapters.size !== reading.chapters.length) {
    reading.chapters = Array.from(mergedChapters)
    writeReading(reading)
  }
  return readingCount(reading)
}

export function subscribeBibleDailyReading(
  listener: (detail: BibleDailyReadingEventDetail) => void,
) {
  if (typeof window === 'undefined') return () => undefined

  const handleCustomEvent = (event: Event) => {
    listener((event as CustomEvent<BibleDailyReadingEventDetail>).detail)
  }
  const handleStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(BIBLE_DAILY_READING_STORAGE_PREFIX) || !event.newValue) return
    try {
      const stored = JSON.parse(event.newValue) as Partial<StoredBibleDailyReading>
      if (typeof stored.userId !== 'string' || typeof stored.date !== 'string') return
      const reading = parseReading(event.newValue, stored.userId, stored.date)
      listener({
        userId: reading.userId,
        date: reading.date,
        count: readingCount(reading),
      })
    } catch {
      // Ignore malformed values written by older or unrelated clients.
    }
  }

  window.addEventListener(BIBLE_DAILY_READING_EVENT, handleCustomEvent)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(BIBLE_DAILY_READING_EVENT, handleCustomEvent)
    window.removeEventListener('storage', handleStorage)
  }
}
