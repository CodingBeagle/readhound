/**
 * Stored records, from the design doc's "Schema" section. All IDs are app
 * generated UUIDs. Timestamps are UTC ISO 8601 strings; calendar dates are
 * `YYYY-MM-DD` in the user's local time zone.
 */
import type { SourceRef } from '@/sources/types'

export type { SourceRef }

export interface Work {
  id: string
  /** Absent for manual works. */
  sourceRef?: SourceRef
  title: string
  /** Ordered. */
  authorIds: string[]
  firstPublishYear?: number
  /** ISO 639-2/B, often user-supplied. */
  originalLanguage?: string
  /** Raw source subjects, offered as category suggestions only. */
  subjects: string[]
  description?: string
  medianPageCount?: number
  fetchedAt?: string
}

export type EditionFormat = 'hardcover' | 'paperback' | 'ebook' | 'audiobook' | 'other'

export type EditableField =
  | 'title'
  | 'subtitle'
  | 'isbn13'
  | 'isbn10'
  | 'publisher'
  | 'publishYear'
  | 'pageCount'
  | 'language'
  | 'format'
  | 'coverUrl'

export interface Edition {
  id: string
  workId: string
  sourceRef?: SourceRef
  title: string
  subtitle?: string
  isbn13?: string
  isbn10?: string
  publisher?: string
  publishYear?: number
  pageCount?: number
  /** Language of this edition. */
  language?: string
  format?: EditionFormat
  /** Remote URL or local blob reference. */
  coverUrl?: string
  /** Values taken from the work or another edition, so the user can correct them. */
  borrowed: { pageCount?: boolean; coverUrl?: boolean }
  /** User edits; they win over source values and survive refreshes. */
  overrides: Partial<Record<EditableField, unknown>>
  fetchedAt?: string
}

export interface Author {
  id: string
  sourceRef?: SourceRef
  name: string
  /** ISO 3166-1 alpha-2, for the author map stat. */
  country?: string
  wikidataId?: string
  overrides: Partial<Record<'name' | 'country', unknown>>
}

export type Status = 'to_read' | 'reading' | 'finished' | 'dnf'

export const STATUSES: readonly Status[] = ['to_read', 'reading', 'finished', 'dnf']

/** My copy of one edition; unique per editionId. */
export interface LibraryEntry {
  id: string
  editionId: string
  status: Status
  addedAt: string
  statusChangedAt: string
  /** 0.5–5 in 0.5 steps (the scale is still an open question). */
  rating?: number
  categoryIds: string[]
  favourite: boolean
}

/** One attempt at reading the book. */
export interface Read {
  id: string
  entryId: string
  /** Date. */
  startedOn: string
  /** Date, set when finished or DNF. */
  endedOn?: string
  /** Absent while in progress. */
  outcome?: 'finished' | 'dnf'
  /** For DNF. */
  stoppedAtPage?: number
}

export interface ReadingSession {
  id: string
  readId: string
  /** Timestamp. */
  startedAt: string
  /**
   * IANA time zone the session was logged in, so a session keeps its local
   * date when the user travels (counting rules: "captured per session").
   */
  timeZone: string
  durationMinutes?: number
  /** Page reached before the session. */
  fromPage: number
  /** Page reached after the session. */
  toPage: number
  /** toPage − fromPage, stored for fast stats. */
  pagesRead: number
}

export interface List {
  id: string
  name: string
  description?: string
  createdAt: string
  sortOrder: number
}

export interface ListItem {
  listId: string
  entryId: string
  position: number
  addedAt: string
}

export interface Category {
  id: string
  name: string
  kind: 'genre' | 'shelf'
  isFiction?: boolean
  colour?: string
}

export interface Note {
  id: string
  entryId: string
  readId?: string
  page?: number
  kind: 'note' | 'quote'
  /** Plain text with markdown allowed. */
  text: string
  createdAt: string
  updatedAt: string
}

export interface Goal {
  year: number
  targetBooks?: number
  targetPages?: number
}

/** Key-value app settings, e.g. preferred languages and the last backup time. */
export interface Setting {
  key: string
  value: unknown
}

/**
 * A book series, such as "Afdeling Q" or "Discworld". Series are linked at
 * the work level, so any edition the user owns counts toward its series.
 */
export interface Series {
  id: string
  name: string
  /** How many books the series has, when known. Falls back to the number of members. */
  totalBooks?: number
  /** Wikidata item of the series (e.g. "Q1093045"), when it was detected there. */
  wikidataId?: string
  /** Where the series came from. User edits never get overwritten by detection. */
  origin: SeriesOrigin
  createdAt: string
}

export type SeriesOrigin = 'manual' | 'openlibrary' | 'wikidata'

/**
 * One book's place in a series. A member is either a work in the library
 * (`workId`) or a book the user doesn't own yet (title only), so a series can
 * show its gaps. When the user later adds that book, the member is linked to
 * the new work.
 */
export interface SeriesMember {
  id: string
  seriesId: string
  /** Set when the book is in the library. */
  workId?: string
  /** Shown for books not in the library; kept as a fallback when the work is removed. */
  title: string
  authorName?: string
  /** Order in the series; decimals allowed for novellas (e.g. 3.5). Undefined sorts last. */
  position?: number
  /** Catalog references, used to link the member when the user adds the book. */
  olWorkId?: string
  wikidataId?: string
  origin: SeriesOrigin
  addedAt: string
}
