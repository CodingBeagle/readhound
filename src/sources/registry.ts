import { parseIsbn } from './isbn'
import type { BookSource, EditionDetails, SearchQuery, SearchResult, SourceId } from './types'

export type SearchOutcome =
  | { kind: 'isbn'; source: SourceId; edition: EditionDetails }
  | { kind: 'results'; source: SourceId; results: SearchResult[] }
  | { kind: 'none' }

/**
 * Holds the book sources in priority order. The UI talks only to the
 * registry, never to an adapter directly.
 */
export class SourceRegistry {
  private readonly sources: readonly BookSource[]

  constructor(sources: readonly BookSource[]) {
    this.sources = sources
  }

  get(id: SourceId): BookSource | undefined {
    return this.sources.find((s) => s.id === id)
  }

  /**
   * Free-text search. A valid ISBN-10/13 in the text runs an ISBN lookup
   * first. Otherwise each source is asked in priority order and the first
   * one with matches wins. `none` means the UI should offer manual entry.
   */
  async search(query: SearchQuery, signal?: AbortSignal): Promise<SearchOutcome> {
    const isbn = query.isbn ? parseIsbn(query.isbn) : query.text ? parseIsbn(query.text) : null
    if (isbn) {
      const hit = await this.lookupIsbn(isbn)
      if (hit) return { kind: 'isbn', ...hit }
    }
    for (const source of this.sources) {
      signal?.throwIfAborted()
      const results = await source.search(query, signal)
      if (results.length > 0) return { kind: 'results', source: source.id, results }
    }
    return { kind: 'none' }
  }

  /** Asks each source in order and returns the first edition found. */
  async lookupIsbn(isbn: string): Promise<{ source: SourceId; edition: EditionDetails } | null> {
    for (const source of this.sources) {
      const edition = await source.lookupIsbn(isbn)
      if (edition) return { source: source.id, edition }
    }
    return null
  }
}
