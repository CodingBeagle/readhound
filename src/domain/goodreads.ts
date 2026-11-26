/**
 * Goodreads library export (`goodreads_library_export.csv`, from Goodreads >
 * My Books > Import and export) read into Readhound's shapes (design doc,
 * Goodreads import). Pure: no database, no network.
 */
import { normalizeIsbn, isValidIsbn10, isValidIsbn13 } from '@/sources/isbn'

import { parseCsv } from './csv'
import { genreForCategory, type GenreId } from './genres'
import type { EditionFormat, Status } from './types'

export class GoodreadsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoodreadsError'
  }
}

/** One finished, DNF or in-progress read made from a row. */
export interface GoodreadsRead {
  startedOn: string
  endedOn?: string
  outcome?: 'finished' | 'dnf'
  /**
   * Goodreads exports only the day a book was finished, so the start is a
   * stand-in (the end date, or the day it was shelved). Time-to-finish stats
   * skip such reads.
   */
  startUnknown: boolean
}

/** One row of the export, mapped. */
export interface GoodreadsBook {
  /** Row number in the file (the header is row 1), for messages. */
  row: number
  goodreadsId?: string
  /** Title without the "(Series, #2)" suffix. */
  title: string
  /** The title exactly as Goodreads has it. */
  fullTitle: string
  authors: string[]
  isbn13?: string
  isbn10?: string
  status: Status
  /** 1–5, or undefined for unrated (Goodreads writes 0). */
  rating?: number
  publisher?: string
  format?: EditionFormat
  pageCount?: number
  publishYear?: number
  firstPublishYear?: number
  /** `YYYY-MM-DD`. */
  addedOn: string
  reads: GoodreadsRead[]
  owned: boolean
  favourite: boolean
  /** Shelves that become Readhound lists, as list names. */
  lists: string[]
  /** Shelves that name one of Readhound's genres. */
  genres: GenreId[]
  series?: { name: string; position?: number }
  review?: string
  privateNotes?: string
}

export interface GoodreadsFile {
  books: GoodreadsBook[]
  /** Rows that couldn't be used (no title), with the reason. */
  skippedRows: { row: number; reason: string }[]
}

const REQUIRED = ['Title', 'Author', 'Exclusive Shelf'] as const

/** Exclusive shelves (and plain shelves) that mean "did not finish". */
const DNF_SHELF = /^(dnf|did[-\s]?not[-\s]?finish(ed)?|abandon(ed)?|gave[-\s]?up|not[-\s]?finish(ed)?|unfinished|stopped([-\s]reading)?|dropped|quit)$/i
const OWNED_SHELF = /^(owned|owned[-\s]books?|own|i[-\s]own|my[-\s](books|library|bookshelf)|bookshelf|physical[-\s]copy)$/i
const FAVOURITE_SHELF = /^(favou?rites?|all[-\s]time[-\s]favou?rites?|faves?)$/i
const STANDARD_SHELVES = new Set(['to-read', 'currently-reading', 'read'])

const BINDINGS: [RegExp, EditionFormat][] = [
  [/audio|audible|mp3/i, 'audiobook'],
  [/kindle|ebook|e-book|nook|digital|epub/i, 'ebook'],
  [/hardcover|hardback|library binding|board book/i, 'hardcover'],
  [/paperback|softcover|pocket|mass market/i, 'paperback'],
]

/** Goodreads "Binding" to a Readhound format; unknown bindings are `other`. */
export function formatFromBinding(binding: string | undefined): EditionFormat | undefined {
  const b = binding?.trim()
  if (!b) return undefined
  return BINDINGS.find(([re]) => re.test(b))?.[1] ?? 'other'
}

/** Goodreads writes ISBNs as `="0439023483"` so spreadsheets keep the leading zero. */
export function cleanIsbn(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const isbn = normalizeIsbn(raw.replace(/^=?"?|"$/g, ''))
  if (isbn.length === 13 && isValidIsbn13(isbn)) return isbn
  if (isbn.length === 10 && isValidIsbn10(isbn)) return isbn
  return undefined
}

/** `2023/05/14` (or `2023-05-14`) to `2023-05-14`; anything else is undefined. */
export function parseGoodreadsDate(raw: string | undefined): string | undefined {
  const m = raw?.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (!m) return undefined
  const [, y, mo, d] = m
  const date = `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  return Number.isNaN(Date.parse(date)) ? undefined : date
}

/** "The Way of Kings (The Stormlight Archive, #1)" → title and series. */
export function splitSeries(fullTitle: string): { title: string; series?: { name: string; position?: number } } {
  const m = fullTitle.match(/^(.*\S)\s*\(([^()]+?),?\s+#(\d+(?:\.\d+)?)(?:-\d+)?\)\s*$/)
  if (!m) return { title: fullTitle.trim() }
  return { title: m[1]!, series: { name: m[2]!.trim(), position: Number(m[3]) } }
}

/** "summer-reading-2024" → "Summer reading 2024". */
export function shelfToListName(shelf: string): string {
  const words = shelf.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Goodreads reviews are HTML-ish: `<br/>` line breaks and the odd `<i>`. */
export function reviewText(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || undefined
}

const positiveInt = (raw: string | undefined) => {
  const n = Number(raw?.trim())
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/** The reads a row stands for (design doc, Goodreads import, "Reads"). */
export function readsFor(input: { status: Status; dateRead?: string; dateStarted?: string; addedOn: string; readCount: number }): GoodreadsRead[] {
  const { status, dateRead, dateStarted, addedOn } = input
  const reads: GoodreadsRead[] = []
  const finished = (endedOn: string, startedOn?: string): GoodreadsRead => ({
    startedOn: startedOn && startedOn <= endedOn ? startedOn : endedOn,
    endedOn,
    outcome: 'finished',
    startUnknown: !(startedOn && startedOn <= endedOn),
  })

  if (status === 'dnf') {
    const end = dateRead ?? addedOn
    const start = dateStarted && dateStarted <= end ? dateStarted : addedOn <= end ? addedOn : end
    return [{ startedOn: start, endedOn: end, outcome: 'dnf', startUnknown: !dateStarted }]
  }

  // Finished reads: the last one on Date Read; earlier rereads have no date in the export, so they go on the day the book was shelved.
  let count: number
  if (status === 'reading') count = dateRead ? Math.max(1, input.readCount - 1) : 0 // Goodreads counts the read in progress.
  else if (status === 'finished' || dateRead) count = Math.max(1, input.readCount)
  else count = input.readCount
  const lastEnd = dateRead ?? addedOn
  const earlier = addedOn <= lastEnd ? addedOn : lastEnd
  for (let i = 1; i < count; i++) reads.push(finished(earlier))
  if (count > 0) reads.push(finished(lastEnd, status === 'finished' ? dateStarted : undefined))

  if (status === 'reading') {
    const start = dateStarted ?? addedOn
    reads.push({ startedOn: dateRead && start < dateRead ? dateRead : start, startUnknown: !dateStarted })
  }
  return reads
}

function statusOf(exclusive: string): { status: Status; list?: string } {
  const shelf = exclusive.trim().toLowerCase()
  if (shelf === 'to-read' || shelf === '') return { status: 'to_read' }
  if (shelf === 'currently-reading') return { status: 'reading' }
  if (shelf === 'read') return { status: 'finished' }
  if (DNF_SHELF.test(shelf)) return { status: 'dnf' }
  // Another custom exclusive shelf (e.g. "on-hold"): keep it as a list, and the book waits as to read.
  return { status: 'to_read', list: shelfToListName(exclusive) }
}

/**
 * Reads a Goodreads export. Throws `GoodreadsError` if the file isn't one.
 * `today` (`YYYY-MM-DD`) stands in for a missing Date Added.
 */
export function parseGoodreadsCsv(text: string, today: string): GoodreadsFile {
  const rows = parseCsv(text)
  const header = rows[0]?.map((h) => h.trim())
  if (!header || REQUIRED.some((name) => !header.includes(name)))
    throw new GoodreadsError('This is not a Goodreads library export. Export it from Goodreads under My Books → Import and export, then pick goodreads_library_export.csv.')
  const col = new Map(header.map((name, i) => [name, i]))
  const books: GoodreadsBook[] = []
  const skippedRows: GoodreadsFile['skippedRows'] = []

  rows.slice(1).forEach((cells, i) => {
    const get = (name: string) => {
      const index = col.get(name)
      const value = index === undefined ? undefined : cells[index]?.trim()
      return value ? value : undefined
    }
    const row = i + 2
    const fullTitle = get('Title')
    if (!fullTitle) {
      skippedRows.push({ row, reason: 'no title' })
      return
    }
    const { title, series } = splitSeries(fullTitle)
    const authors = [get('Author'), ...(get('Additional Authors')?.split(',') ?? [])].map((a) => a?.trim().replace(/\s+/g, ' ')).filter((a): a is string => !!a)
    const exclusive = get('Exclusive Shelf') ?? ''
    const { status, list: exclusiveList } = statusOf(exclusive)
    const addedOn = parseGoodreadsDate(get('Date Added')) ?? today
    const ratingValue = Number(get('My Rating') ?? 0)

    const shelves = (get('Bookshelves') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    let owned = (positiveInt(get('Owned Copies')) ?? 0) > 0
    let favourite = false
    const lists = exclusiveList ? [exclusiveList] : []
    const genres: GenreId[] = []
    for (const shelf of shelves) {
      const key = shelf.toLowerCase()
      if (STANDARD_SHELVES.has(key) || key === exclusive.toLowerCase() || DNF_SHELF.test(key)) continue
      if (OWNED_SHELF.test(key)) owned = true
      else if (FAVOURITE_SHELF.test(key)) favourite = true
      else {
        const genre = genreForCategory(shelf.replace(/[-_]+/g, ' '))
        if (genre) {
          if (!genres.includes(genre)) genres.push(genre)
        } else {
          const name = shelfToListName(shelf)
          if (!lists.some((l) => l.toLowerCase() === name.toLowerCase())) lists.push(name)
        }
      }
    }

    books.push({
      row,
      goodreadsId: get('Book Id'),
      title,
      fullTitle,
      authors: authors.length ? authors : ['Unknown author'],
      isbn13: cleanIsbn(get('ISBN13')),
      isbn10: cleanIsbn(get('ISBN')),
      status,
      rating: ratingValue >= 1 && ratingValue <= 5 ? ratingValue : undefined,
      publisher: get('Publisher'),
      format: formatFromBinding(get('Binding')),
      pageCount: positiveInt(get('Number of Pages')),
      publishYear: positiveInt(get('Year Published')),
      firstPublishYear: positiveInt(get('Original Publication Year')),
      addedOn,
      reads: readsFor({
        status,
        dateRead: parseGoodreadsDate(get('Date Read')),
        dateStarted: parseGoodreadsDate(get('Date Started')),
        addedOn,
        readCount: positiveInt(get('Read Count')) ?? 0,
      }),
      owned,
      favourite,
      lists,
      genres,
      series,
      review: reviewText(get('My Review')),
      privateNotes: get('Private Notes'),
    })
  })
  return { books, skippedRows }
}

/** Lower case, no diacritics or punctuation: for matching titles and authors across catalogs. */
export function matchKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/å/gi, 'a')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Title plus the first author's surname, for spotting a book already in the library. */
export function titleAuthorKey(title: string, authors: readonly string[]): string {
  const main = matchKey(title.split(/[:(]/)[0] ?? title)
  const surname = matchKey(authors[0] ?? '').split(' ').at(-1) ?? ''
  return `${main}|${surname}`
}

export interface ImportCounts {
  books: number
  byStatus: Record<Status, number>
  finishedReads: number
  rereads: number
  rated: number
  owned: number
  reviews: number
  withIsbn: number
  lists: string[]
}

/** The numbers shown in the import preview. */
export function importCounts(books: readonly GoodreadsBook[]): ImportCounts {
  const byStatus: Record<Status, number> = { to_read: 0, reading: 0, finished: 0, dnf: 0 }
  const lists = new Map<string, string>()
  let finishedReads = 0
  let rereads = 0
  for (const b of books) {
    byStatus[b.status]++
    const finished = b.reads.filter((r) => r.outcome === 'finished').length
    finishedReads += finished
    rereads += Math.max(0, finished - 1)
    for (const l of b.lists) if (!lists.has(l.toLowerCase())) lists.set(l.toLowerCase(), l)
  }
  return {
    books: books.length,
    byStatus,
    finishedReads,
    rereads,
    rated: books.filter((b) => b.rating !== undefined).length,
    owned: books.filter((b) => b.owned).length,
    reviews: books.filter((b) => b.review || b.privateNotes).length,
    withIsbn: books.filter((b) => b.isbn13 || b.isbn10).length,
    lists: [...lists.values()].sort((a, b) => a.localeCompare(b)),
  }
}
