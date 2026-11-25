/**
 * Pure mapping from Open Library JSON to the app's source types.
 * Field notes come from the design doc ("Open Library adapter").
 */
import { parseSeriesLabel } from '@/domain/series'

import type { AuthorRef, EditionDetails, SearchResult, SeriesHint, SourceRef } from '../types'

// --- Raw Open Library shapes (only the fields we read) ---

export interface OlKeyRef {
  key: string
}

export interface OlText {
  type?: string
  value: string
}

export interface OlSearchDoc {
  key: string
  title?: string
  author_name?: string[]
  author_key?: string[]
  first_publish_year?: number
  edition_count?: number
  language?: string[]
  number_of_pages_median?: number
  cover_i?: number
}

export interface OlSearchResponse {
  numFound: number
  docs: OlSearchDoc[]
}

export interface OlEdition {
  key: string
  title?: string
  subtitle?: string
  authors?: OlKeyRef[]
  works?: OlKeyRef[]
  isbn_10?: string[]
  isbn_13?: string[]
  publishers?: string[]
  publish_date?: string
  number_of_pages?: number
  languages?: OlKeyRef[]
  physical_format?: string
  covers?: number[]
  subjects?: string[]
  description?: string | OlText
  /** Free text such as "Harry Potter, #1" or "Discworld -- 3". */
  series?: string[]
}

export interface OlWork {
  key: string
  title?: string
  authors?: ({ author: OlKeyRef } | OlKeyRef)[]
  description?: string | OlText
  subjects?: string[]
  covers?: number[]
}

export interface OlAuthor {
  key: string
  name?: string
  personal_name?: string
}

export interface OlEditionsResponse {
  size?: number
  entries: OlEdition[]
}

// --- Helpers ---

export type CoverSize = 'S' | 'M' | 'L'

/** Covers are always loaded by cover ID; loading by ISBN is heavily rate limited. */
export function coverUrl(coverId: number, size: CoverSize = 'M'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}

/** `/works/OL21745884W` → `OL21745884W`. */
export function olid(key: string): string {
  return key.slice(key.lastIndexOf('/') + 1)
}

export function olRef(key: string): SourceRef {
  return { source: 'openlibrary', id: olid(key) }
}

/** Work and edition descriptions are either a string or `{type, value}`. */
export function normalizeText(text: string | OlText | undefined): string | undefined {
  const value = typeof text === 'string' ? text : text?.value
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Free-text dates such as "May 04, 2021", "2015-12-11" or "2000": take the first 4-digit year. */
export function parsePublishYear(publishDate: string | undefined): number | undefined {
  const match = publishDate?.match(/\b(\d{4})\b/)
  return match ? Number(match[1]) : undefined
}

/** First positive cover ID; Open Library uses -1 for removed covers. */
export function firstCoverId(covers: number[] | undefined): number | undefined {
  return covers?.find((id) => id > 0)
}

/** `[{key: "/languages/dan"}]` → `"dan"`. Often missing. */
export function editionLanguage(languages: OlKeyRef[] | undefined): string | undefined {
  const key = languages?.[0]?.key
  return key ? olid(key) : undefined
}

/** Author keys listed on a work, in order. */
export function workAuthorKeys(work: OlWork): string[] {
  return (work.authors ?? []).map((a) => ('author' in a ? a.author.key : a.key))
}

const NOISE_PREFIXES = ['summary of', 'summary and analysis', 'study guide', 'summary']

/** Drops "Summary of…" style companion books. */
export function isNoise(title: string): boolean {
  const lower = title.trim().toLowerCase()
  return NOISE_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

// --- Mappers ---

export function mapSearchDoc(doc: OlSearchDoc): SearchResult {
  const names = doc.author_name ?? []
  const keys = doc.author_key ?? []
  const authors: AuthorRef[] = keys.map((key, i) => ({ ref: olRef(key), name: names[i] ?? '' }))
  return {
    work: olRef(doc.key),
    title: doc.title ?? '',
    authors,
    firstPublishYear: doc.first_publish_year,
    editionCount: doc.edition_count ?? 0,
    medianPageCount: doc.number_of_pages_median,
    coverUrl: doc.cover_i && doc.cover_i > 0 ? coverUrl(doc.cover_i) : undefined,
    languages: doc.language ?? [],
  }
}

/** Search results: noise removed, Open Library's relevance order kept. */
export function mapSearchResponse(response: OlSearchResponse): SearchResult[] {
  return response.docs.filter((doc) => doc.title && !isNoise(doc.title)).map(mapSearchDoc)
}

/**
 * Maps an edition. `authors` must already be resolved to names, because
 * editions only carry author keys. Returns null if the edition has no work.
 */
export function mapEdition(edition: OlEdition, authors: AuthorRef[]): EditionDetails | null {
  const workKey = edition.works?.[0]?.key
  if (!workKey) return null
  const cover = firstCoverId(edition.covers)
  return {
    edition: olRef(edition.key),
    work: olRef(workKey),
    title: edition.title ?? '',
    subtitle: edition.subtitle,
    authors,
    isbn10: edition.isbn_10 ?? [],
    isbn13: edition.isbn_13 ?? [],
    publishers: edition.publishers ?? [],
    publishDate: edition.publish_date,
    publishYear: parsePublishYear(edition.publish_date),
    pageCount: edition.number_of_pages && edition.number_of_pages > 0 ? edition.number_of_pages : undefined,
    language: editionLanguage(edition.languages),
    format: edition.physical_format,
    coverUrl: cover ? coverUrl(cover) : undefined,
    subjects: edition.subjects ?? [],
    description: normalizeText(edition.description),
    series: editionSeries(edition.series),
  }
}

/** Parses Open Library's series labels, dropping duplicates. Undefined when there are none. */
export function editionSeries(labels: string[] | undefined): SeriesHint[] | undefined {
  const hints: SeriesHint[] = []
  for (const label of labels ?? []) {
    const hint = parseSeriesLabel(label)
    if (hint && !hints.some((h) => h.name.toLowerCase() === hint.name.toLowerCase())) hints.push(hint)
  }
  return hints.length ? hints : undefined
}
