/**
 * The joined data every stat works on, built once from the stored records.
 * All stat functions are pure and take this model, so they are easy to test
 * against a fixed data set (design doc, acceptance criterion 7).
 */
import { effectiveAuthorName, effectiveEdition } from '../effective'
import type { Author, Category, Edition, LibraryEntry, Read, ReadingSession, Work } from '../types'
import { localParts } from './calendar'

export interface StatsInput {
  entries: readonly LibraryEntry[]
  editions: readonly Edition[]
  works: readonly Work[]
  authors: readonly Author[]
  reads: readonly Read[]
  sessions: readonly ReadingSession[]
  categories: readonly Category[]
}

export interface StatAuthor {
  id: string
  name: string
  country?: string
}

/** A library entry with everything stats need about the book. */
export interface StatBook {
  entry: LibraryEntry
  /** Edition with overrides applied. */
  edition: Edition
  work?: Work
  workId: string
  authors: StatAuthor[]
  title: string
  pageCount?: number
  language?: string
  originalLanguage?: string
  firstPublishYear?: number
  genres: Category[]
  /** true / false from flagged genre categories; undefined when none is flagged. */
  isFiction?: boolean
}

/** A session with its local date and hour resolved once. */
export interface StatSession extends ReadingSession {
  date: string
  hour: number
  book: StatBook
  read: StatRead
}

export interface StatRead extends Read {
  book: StatBook
  sessions: StatSession[]
}

export interface StatsModel {
  books: StatBook[]
  reads: StatRead[]
  sessions: StatSession[]
  categories: Category[]
  /** Pages per local date, by the counting rules (sessions, plus finished reads without sessions on their end date). */
  pagesByDate: Map<string, number>
}

export function buildStatsModel(input: StatsInput): StatsModel {
  const editionById = new Map(input.editions.map((e) => [e.id, e]))
  const workById = new Map(input.works.map((w) => [w.id, w]))
  const authorById = new Map(input.authors.map((a) => [a.id, a]))
  const categoryById = new Map(input.categories.map((c) => [c.id, c]))

  const bookByEntry = new Map<string, StatBook>()
  const books: StatBook[] = []
  for (const entry of input.entries) {
    const raw = editionById.get(entry.editionId)
    if (!raw) continue
    const edition = effectiveEdition(raw)
    const work = workById.get(edition.workId)
    const genres = entry.categoryIds.flatMap((id) => {
      const c = categoryById.get(id)
      return c && c.kind === 'genre' ? [c] : []
    })
    const flags = genres.map((g) => g.isFiction).filter((f): f is boolean => f !== undefined)
    const book: StatBook = {
      entry,
      edition,
      work,
      workId: edition.workId,
      authors: (work?.authorIds ?? []).flatMap((id) => {
        const a = authorById.get(id)
        if (!a) return []
        return [{ id: a.id, name: effectiveAuthorName(a), country: (a.overrides.country as string | undefined) ?? a.country }]
      }),
      title: edition.title,
      pageCount: edition.pageCount,
      language: edition.language,
      originalLanguage: work?.originalLanguage,
      firstPublishYear: work?.firstPublishYear ?? edition.publishYear,
      genres,
      // Any fiction genre makes the book fiction; otherwise non-fiction if a flag says so.
      isFiction: flags.length ? flags.includes(true) : undefined,
    }
    books.push(book)
    bookByEntry.set(entry.id, book)
  }

  const reads: StatRead[] = []
  const readById = new Map<string, StatRead>()
  for (const r of input.reads) {
    const book = bookByEntry.get(r.entryId)
    if (!book) continue
    const read: StatRead = { ...r, book, sessions: [] }
    reads.push(read)
    readById.set(r.id, read)
  }

  const sessions: StatSession[] = []
  const pagesByDate = new Map<string, number>()
  for (const s of input.sessions) {
    const read = readById.get(s.readId)
    if (!read) continue
    const { date, hour } = localParts(s.startedAt, s.timeZone)
    const session: StatSession = { ...s, date, hour, book: read.book, read }
    sessions.push(session)
    read.sessions.push(session)
    pagesByDate.set(date, (pagesByDate.get(date) ?? 0) + s.pagesRead)
  }
  for (const read of reads) {
    read.sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    // A finished read with no sessions counts its page count on its end date.
    if (read.outcome === 'finished' && read.endedOn && read.sessions.length === 0 && read.book.pageCount)
      pagesByDate.set(read.endedOn, (pagesByDate.get(read.endedOn) ?? 0) + read.book.pageCount)
  }
  sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  return { books, reads, sessions, categories: [...input.categories], pagesByDate }
}
