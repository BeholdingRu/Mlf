import { createClient } from '@supabase/supabase-js'

const SOURCE_URL = 'https://raw.githubusercontent.com/seven1m/open-bibles/master/rus-synodal.zefania.xml'
const BATCH_SIZE = 500

function readEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Не задана переменная окружения ${name}.`)
  return value
}

async function main() {
  const supabase = createClient(
    readEnv('VITE_SUPABASE_URL'),
    readEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`Не удалось скачать исходный текст: ${response.status} ${response.statusText}`)

  const source = await response.text()
  const verses = parseZefaniaXml(source)

  if (verses.length !== 31_352) throw new Error(`Источник содержит ${verses.length} стихов вместо ожидаемых 31352; импорт отменён.`)

  for (let start = 0; start < verses.length; start += BATCH_SIZE) {
    const batch = verses.slice(start, start + BATCH_SIZE)
    const { error } = await supabase
      .from('bible_verses')
      .upsert(batch, { onConflict: 'book_code,chapter,verse' })
    if (error) throw error
    console.log(`Загружено ${Math.min(start + batch.length, verses.length)} из ${verses.length} стихов`)
  }

  const { count, error } = await supabase
    .from('bible_verses')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  console.log(`Импорт завершён. В таблице bible_verses: ${count} стихов.`)
}

function parseZefaniaXml(source) {
  const books = [...source.matchAll(/<BIBLEBOOK\s+bnumber="(\d+)"\s+bname="([^"]+)"[^>]*>([\s\S]*?)<\/BIBLEBOOK>/g)]
  if (books.length !== 66) throw new Error(`Источник содержит ${books.length} книг вместо ожидаемых 66; импорт отменён.`)

  return books.flatMap(([, bookOrder, bookName, bookContent]) => {
    const bookCode = `rst-${bookOrder}`
    return [...bookContent.matchAll(/<CHAPTER\s+cnumber="(\d+)"[^>]*>([\s\S]*?)<\/CHAPTER>/g)].flatMap(([, chapter, chapterContent]) =>
      [...chapterContent.matchAll(/<VERS\s+vnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/g)].map(([, verse, text]) => ({
        book_code: bookCode,
        book_name: decodeXml(bookName),
        book_order: Number(bookOrder),
        chapter: Number(chapter),
        verse: Number(verse),
        text: decodeXml(text.replace(/<[^>]+>/g, '')).trim(),
      })),
    )
  })
}

function decodeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
