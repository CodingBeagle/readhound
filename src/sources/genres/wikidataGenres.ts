/**
 * A book's genres on Wikidata ("genre", P136), e.g. "science fiction novel"
 * or "crime novel". The book is found the same way as for series (Open
 * Library IDs, else title and author). Labels are asked for in English,
 * since the genre mapping (domain/genres.ts) matches English phrases.
 */
import type { HttpClient } from '../http'
import { bookPattern, OLID, WIKIDATA_SPARQL, WIKIDATA_TTL_MS, type BookLookup, type SparqlResponse } from '../series'

export function genreQuery(book: BookLookup): string {
  return `SELECT DISTINCT ?genre ?genreLabel WHERE {
  ${bookPattern(book)}
  ?work wdt:P136 ?genre .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}
LIMIT 50`
}

/** Genre labels from a query response; labels that are bare item ids (no English name) are skipped. */
export function mapGenreResponse(response: SparqlResponse): string[] {
  const labels = new Set<string>()
  for (const row of response.results.bindings) {
    const label = row.genreLabel?.value
    const id = row.genre?.value.slice(row.genre.value.lastIndexOf('/') + 1)
    if (label && label !== id) labels.add(label)
  }
  return [...labels]
}

export class WikidataGenreLookup {
  private readonly http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /** Genre labels of the book; empty when Wikidata doesn't know it. */
  async genresFor(book: BookLookup, signal?: AbortSignal): Promise<string[]> {
    const hasId = (book.olids ?? []).some((id) => OLID.test(id))
    const hasTitle = (book.titles ?? []).some((t) => t.trim()) && (book.authors ?? []).some((a) => a.trim())
    if (!hasId && !hasTitle) return []
    const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(genreQuery(book))}`
    const response = await this.http.getJson<SparqlResponse>(url, {
      cacheTtlMs: WIKIDATA_TTL_MS,
      signal,
    })
    return response ? mapGenreResponse(response) : []
  }
}
