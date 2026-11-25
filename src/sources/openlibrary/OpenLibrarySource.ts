import { HttpClient } from '../http'
import { normalizeIsbn } from '../isbn'
import type {
  AuthorRef,
  BookSource,
  EditionDetails,
  ListEditionsOptions,
  SearchQuery,
  SearchResult,
  SourceRef,
  WorkDetails,
} from '../types'
import {
  mapEdition,
  mapSearchResponse,
  normalizeText,
  olRef,
  workAuthorKeys,
  type OlAuthor,
  type OlEdition,
  type OlEditionsResponse,
  type OlSearchResponse,
  type OlWork,
} from './mappers'

const BASE = 'https://openlibrary.org'
const SEARCH_FIELDS =
  'key,title,author_name,author_key,first_publish_year,edition_count,language,number_of_pages_median,cover_i'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** Search responses stay fresh for 24 hours, edition, work and author responses for 30 days. */
export const SEARCH_TTL_MS = DAY
export const RECORD_TTL_MS = 30 * DAY

export class OpenLibrarySource implements BookSource {
  readonly id = 'openlibrary' as const
  private readonly http: HttpClient

  constructor(http: HttpClient = new HttpClient()) {
    this.http = http
  }

  async search(q: SearchQuery, signal?: AbortSignal): Promise<SearchResult[]> {
    const params = new URLSearchParams()
    const text = [q.text?.trim(), q.subject?.trim() && `subject_key:${subjectKey(q.subject)}`].filter(Boolean).join(' ')
    if (text) params.set('q', text)
    if (q.title?.trim()) params.set('title', q.title.trim())
    if (q.author?.trim()) params.set('author', q.author.trim())
    if (q.isbn?.trim()) params.set('isbn', normalizeIsbn(q.isbn))
    if ([...params.keys()].length === 0) return []
    params.set('fields', q.withSubjects ? `${SEARCH_FIELDS},subject` : SEARCH_FIELDS)
    if (q.popular) params.set('sort', 'rating')
    params.set('limit', String(q.limit ?? 20))

    const response = await this.http.getJson<OlSearchResponse>(`${BASE}/search.json?${params}`, {
      cacheTtlMs: SEARCH_TTL_MS,
      signal,
    })
    return response ? mapSearchResponse(response) : []
  }

  async listEditions(work: SourceRef, opts: ListEditionsOptions = {}): Promise<EditionDetails[]> {
    const { limit = 50, offset = 0, language } = opts
    const url = `${BASE}/works/${work.id}/editions.json?limit=${limit}&offset=${offset}`
    const response = await this.http.getJson<OlEditionsResponse>(url, { cacheTtlMs: RECORD_TTL_MS })
    if (!response) return []

    const entries = language
      ? response.entries.filter((e) => e.languages?.some((l) => l.key === `/languages/${language}`))
      : response.entries

    // Editions of a work often lack authors; fall back to the work's authors.
    let workAuthors: AuthorRef[] | undefined
    const editions: EditionDetails[] = []
    for (const entry of entries) {
      let authors: AuthorRef[]
      if (entry.authors?.length) {
        authors = await this.resolveAuthors(entry.authors.map((a) => a.key))
      } else {
        workAuthors ??= await this.workAuthors(work)
        authors = workAuthors
      }
      const mapped = mapEdition({ ...entry, works: entry.works ?? [{ key: `/works/${work.id}` }] }, authors)
      if (mapped) editions.push(mapped)
    }
    return editions
  }

  async getEdition(edition: SourceRef): Promise<EditionDetails | null> {
    const raw = await this.http.getJson<OlEdition>(`${BASE}/books/${edition.id}.json`, {
      cacheTtlMs: RECORD_TTL_MS,
    })
    return raw ? this.toEditionDetails(raw) : null
  }

  async lookupIsbn(isbn: string): Promise<EditionDetails | null> {
    const raw = await this.http.getJson<OlEdition>(`${BASE}/isbn/${normalizeIsbn(isbn)}.json`, {
      cacheTtlMs: RECORD_TTL_MS,
    })
    return raw ? this.toEditionDetails(raw) : null
  }

  async getWork(work: SourceRef): Promise<WorkDetails | null> {
    const raw = await this.fetchWork(work)
    if (!raw) return null
    return { description: normalizeText(raw.description), subjects: raw.subjects ?? [] }
  }

  private fetchWork(work: SourceRef) {
    return this.http.getJson<OlWork>(`${BASE}/works/${work.id}.json`, { cacheTtlMs: RECORD_TTL_MS })
  }

  private async toEditionDetails(raw: OlEdition): Promise<EditionDetails | null> {
    const workKey = raw.works?.[0]?.key
    let authors: AuthorRef[]
    if (raw.authors?.length) authors = await this.resolveAuthors(raw.authors.map((a) => a.key))
    else authors = workKey ? await this.workAuthors(olRef(workKey)) : []
    return mapEdition(raw, authors)
  }

  private async workAuthors(work: SourceRef): Promise<AuthorRef[]> {
    const raw = await this.fetchWork(work)
    return raw ? this.resolveAuthors(workAuthorKeys(raw)) : []
  }

  /** Looks up author names; authors that can't be found are left out. */
  private async resolveAuthors(keys: string[]): Promise<AuthorRef[]> {
    const authors: AuthorRef[] = []
    for (const key of keys) {
      const ref = olRef(key)
      const raw = await this.http.getJson<OlAuthor>(`${BASE}/authors/${ref.id}.json`, {
        cacheTtlMs: RECORD_TTL_MS,
      })
      const name = raw?.name ?? raw?.personal_name
      if (name) authors.push({ ref, name })
    }
    return authors
  }
}

/** Open Library's subject key: lower case, words joined by underscores ("Science fiction" → "science_fiction"). */
export function subjectKey(subject: string): string {
  return subject
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
}
