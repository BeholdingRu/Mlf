export type BibleBook = {
  order: number
  name: string
  chapters: number
  youVersionCode: string
}

export type BibleNavigationTarget = {
  bookOrder: number
  chapter: number
  requestId: number
}

export const OLD_TESTAMENT: BibleBook[] = [
  ['Бытие', 50, 'GEN'], ['Исход', 40, 'EXO'], ['Левит', 27, 'LEV'], ['Числа', 36, 'NUM'], ['Второзаконие', 34, 'DEU'],
  ['Иисус Навин', 24, 'JOS'], ['Судьи', 21, 'JDG'], ['Руфь', 4, 'RUT'], ['1 Царств', 31, '1SA'], ['2 Царств', 24, '2SA'],
  ['3 Царств', 22, '1KI'], ['4 Царств', 25, '2KI'], ['1 Паралипоменон', 29, '1CH'], ['2 Паралипоменон', 36, '2CH'], ['Ездра', 10, 'EZR'],
  ['Неемия', 13, 'NEH'], ['Есфирь', 10, 'EST'], ['Иов', 42, 'JOB'], ['Псалтирь', 150, 'PSA'], ['Притчи', 31, 'PRO'],
  ['Екклесиаст', 12, 'ECC'], ['Песня Песней', 8, 'SNG'], ['Исаия', 66, 'ISA'], ['Иеремия', 52, 'JER'], ['Плач Иеремии', 5, 'LAM'],
  ['Иезекииль', 48, 'EZK'], ['Даниил', 12, 'DAN'], ['Осия', 14, 'HOS'], ['Иоиль', 3, 'JOL'], ['Амос', 9, 'AMO'],
  ['Авдий', 1, 'OBA'], ['Иона', 4, 'JON'], ['Михей', 7, 'MIC'], ['Наум', 3, 'NAM'], ['Аввакум', 3, 'HAB'],
  ['Софония', 3, 'ZEP'], ['Аггей', 2, 'HAG'], ['Захария', 14, 'ZEC'], ['Малахия', 4, 'MAL'],
].map(([name, chapters, youVersionCode], index) => ({
  order: index + 1,
  name: name as string,
  chapters: chapters as number,
  youVersionCode: youVersionCode as string,
}))

export const NEW_TESTAMENT: BibleBook[] = [
  ['От Матфея', 28, 'MAT'], ['От Марка', 16, 'MRK'], ['От Луки', 24, 'LUK'], ['От Иоанна', 21, 'JHN'], ['Деяния святых Апостолов', 28, 'ACT'],
  ['Послание к Римлянам', 16, 'ROM'], ['Первое послание к Коринфянам', 16, '1CO'], ['Второе послание к Коринфянам', 13, '2CO'],
  ['Послание к Галатам', 6, 'GAL'], ['Послание к Ефесянам', 6, 'EPH'], ['Послание к Филиппийцам', 4, 'PHP'], ['Послание к Колоссянам', 4, 'COL'], ['Первое послание к Фессалоникийцам', 5, '1TH'],
  ['Второе послание к Фессалоникийцам', 3, '2TH'], ['Первое послание к Тимофею', 6, '1TI'], ['Второе послание к Тимофею', 4, '2TI'], ['Послание к Титу', 3, 'TIT'], ['Послание к Филимону', 1, 'PHM'],
  ['Послание к Евреям', 13, 'HEB'], ['Послание Иакова', 5, 'JAS'], ['Первое послание Петра', 5, '1PE'], ['Второе послание Петра', 3, '2PE'], ['Первое послание Иоанна', 5, '1JN'],
  ['Второе послание Иоанна', 1, '2JN'], ['Третье послание Иоанна', 1, '3JN'], ['Послание Иуды', 1, 'JUD'], ['Откровение Иоанна Богослова', 22, 'REV'],
].map(([name, chapters, youVersionCode], index) => ({
  order: index + 40,
  name: name as string,
  chapters: chapters as number,
  youVersionCode: youVersionCode as string,
}))

export const BIBLE_BOOKS = [...OLD_TESTAMENT, ...NEW_TESTAMENT]

export function getNextBibleLocation(bookOrder: number | null | undefined, chapter: number | null | undefined) {
  const bookIndex = BIBLE_BOOKS.findIndex((book) => book.order === bookOrder)
  if (bookIndex < 0 || !chapter) return { bookOrder: BIBLE_BOOKS[0].order, chapter: 1 }

  const book = BIBLE_BOOKS[bookIndex]
  if (chapter < 1 || chapter > book.chapters) return { bookOrder: BIBLE_BOOKS[0].order, chapter: 1 }
  if (chapter < book.chapters) return { bookOrder: book.order, chapter: chapter + 1 }

  const nextBook = BIBLE_BOOKS[bookIndex + 1] ?? BIBLE_BOOKS[0]
  return { bookOrder: nextBook.order, chapter: 1 }
}

export function isBibleReadingTaskTitle(title: string) {
  const normalizedTitle = title.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ').trim()
  return normalizedTitle.includes('чтение библии') || normalizedTitle.includes('чтение бибили')
}
