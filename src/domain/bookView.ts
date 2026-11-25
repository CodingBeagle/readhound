/**
 * The joined, display-ready view of one library entry, and pure helpers to
 * filter and sort the library.
 */
import { effectiveEdition } from './effective'
import type { BookSeries } from './series'
import { currentPage } from './sessions'
import type { Author, Edition, LibraryEntry, Read, ReadingSession, Status, Work } from './types'

export interface BookView {
  entry: LibraryEntry
  /** Edition with the user's overrides applied. */
  edition: Edition
  work: Work | undefined
  authors: Author[]
  authorNames: string[]
  reads: Read[]
  openRead: Read | undefined
  /** Sessions of the open read. */
  openSessions: ReadingSession[]
  /** Page reached in the open read (0 if none). */
  currentPage: number
  /** End date of the latest finished read. */
  lastFinishedOn: string | undefined
  /** Series the book's work belongs to, by series name. */
  series: BookSeries[]
}

export function buildBookView(input: {
  entry: LibraryEntry
  edition: Edition
  work: Work | undefined
  authors: Author[]
  reads: Read[]
  sessions: ReadingSession[]
  series?: BookSeries[]
}): BookView {
  const { entry, work, authors, reads, sessions } = input
  const openRead = reads.find((r) => r.outcome === undefined)
  const openSessions = openRead ? sessions.filter((s) => s.readId === openRead.id) : []
  const lastFinishedOn = reads
    .filter((r) => r.outcome === 'finished' && r.endedOn)
    .map((r) => r.endedOn!)
    .sort()
    .at(-1)
  return {
    entry,
    edition: effectiveEdition(input.edition),
    work,
    authors,
    authorNames: authors.map((a) => (a.overrides.name as string | undefined) ?? a.name),
    reads,
    openRead,
    openSessions,
    currentPage: currentPage(openSessions),
    lastFinishedOn,
    series: input.series ?? [],
  }
}

/** Lower-case and strip diacritics, so "froken" matches "Frøken" and "aero" matches "Ærø". */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export type LibrarySort = 'added' | 'title' | 'author' | 'finished' | 'rating'

export interface LibraryFilter {
  status?: Status
  text?: string
  language?: string
  categoryId?: string
  listEntryIds?: ReadonlySet<string>
  seriesId?: string
}

export function filterBooks(books: readonly BookView[], filter: LibraryFilter): BookView[] {
  const needle = filter.text ? foldText(filter.text.trim()) : ''
  return books.filter(
    (b) =>
      (!filter.status || b.entry.status === filter.status) &&
      (!filter.language || b.edition.language === filter.language) &&
      (!filter.categoryId || b.entry.categoryIds.includes(filter.categoryId)) &&
      (!filter.listEntryIds || filter.listEntryIds.has(b.entry.id)) &&
      (!filter.seriesId || b.series.some((s) => s.series.id === filter.seriesId)) &&
      (!needle || foldText([b.edition.title, b.edition.subtitle ?? '', ...b.authorNames].join(' ')).includes(needle)),
  )
}

const byText = (a: string, b: string) => a.localeCompare(b, 'da', { sensitivity: 'base' })

export function sortBooks(books: readonly BookView[], sort: LibrarySort): BookView[] {
  const sorted = [...books]
  switch (sort) {
    case 'added':
      return sorted.sort((a, b) => b.entry.addedAt.localeCompare(a.entry.addedAt))
    case 'title':
      return sorted.sort((a, b) => byText(a.edition.title, b.edition.title))
    case 'author':
      return sorted.sort((a, b) => byText(a.authorNames[0] ?? '', b.authorNames[0] ?? '') || byText(a.edition.title, b.edition.title))
    case 'finished':
      // Most recently finished first; never-finished books last.
      return sorted.sort((a, b) => (b.lastFinishedOn ?? '').localeCompare(a.lastFinishedOn ?? ''))
    case 'rating':
      return sorted.sort((a, b) => (b.entry.rating ?? -1) - (a.entry.rating ?? -1))
  }
}

/** Reading progress 0–1 against the effective page count, if known. */
export function progress(book: BookView): number | undefined {
  const total = book.edition.pageCount
  return total ? Math.min(1, book.currentPage / total) : undefined
}
