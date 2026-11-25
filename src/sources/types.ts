/**
 * Book source contract, from the design doc ("Source adapter interface").
 * Every catalog (Open Library now, Google Books etc. later) implements
 * `BookSource` and returns data in these shapes.
 */

export type SourceId = 'openlibrary' | 'manual' // extend with "googlebooks" etc. later

/** A record's identity in its source, e.g. { source: "openlibrary", id: "OL21745884W" }. */
export interface SourceRef {
  source: SourceId
  id: string
}

export interface SearchQuery {
  text?: string
  title?: string
  author?: string
  isbn?: string
  /** A subject, matched on the source's normalised subject key (e.g. "science fiction"). */
  subject?: string
  /** Most popular first (Open Library: by rating) instead of by relevance. */
  popular?: boolean
  /** Also return each work's subjects (used by recommendations). */
  withSubjects?: boolean
  limit?: number
}

export interface AuthorRef {
  ref: SourceRef
  name: string
}

/** One search hit per work. */
export interface SearchResult {
  work: SourceRef
  title: string
  authors: AuthorRef[]
  firstPublishYear?: number
  editionCount: number
  medianPageCount?: number
  coverUrl?: string
  /** ISO 639-2/B codes, e.g. "dan", "eng". */
  languages: string[]
  /** Only when asked for with `withSubjects`. */
  subjects?: string[]
}

export interface EditionDetails {
  edition: SourceRef
  work: SourceRef
  title: string
  subtitle?: string
  authors: AuthorRef[]
  isbn10: string[]
  isbn13: string[]
  publishers: string[]
  /** Raw string from the source. */
  publishDate?: string
  /** Parsed from `publishDate`. */
  publishYear?: number
  pageCount?: number
  language?: string
  format?: string
  coverUrl?: string
  subjects: string[]
  description?: string
  /** Series the catalog lists for the edition. A hint only: often missing or messy. */
  series?: SeriesHint[]
}

/** A series name and number as parsed from a catalog label. */
export interface SeriesHint {
  name: string
  position?: number
}

export interface WorkDetails {
  description?: string
  subjects: string[]
}

export interface ListEditionsOptions {
  language?: string
  limit?: number
  offset?: number
}

export interface BookSource {
  id: SourceId
  search(q: SearchQuery, signal?: AbortSignal): Promise<SearchResult[]>
  listEditions(work: SourceRef, opts?: ListEditionsOptions): Promise<EditionDetails[]>
  getEdition(edition: SourceRef): Promise<EditionDetails | null>
  lookupIsbn(isbn: string): Promise<EditionDetails | null>
  getWork(work: SourceRef): Promise<WorkDetails | null>
}
