/**
 * Series detection: Wikidata first (reliable names, numbers and the other
 * books of the series), Open Library's edition series label as a fallback
 * hint. Both are suggestions the user can edit or remove.
 */
import type { EditionDetails, SourceRef } from '../types'
import type { WikidataSeriesLookup } from './wikidata'

export interface SeriesCandidateMember {
  title: string
  position?: number
  olWorkId?: string
  wikidataId?: string
  authorName?: string
}

export interface SeriesCandidate {
  name: string
  /** This book's number in the series. */
  position?: number
  totalBooks?: number
  wikidataId?: string
  origin: 'wikidata' | 'openlibrary'
  /** Other books of the series, so it can show the ones not owned yet. */
  members: SeriesCandidateMember[]
}

export interface DetectInput {
  work?: SourceRef
  edition?: SourceRef
}

export interface SeriesDetectorDeps {
  wikidata: WikidataSeriesLookup
  getEdition: (edition: SourceRef) => Promise<EditionDetails | null>
}

export class SeriesDetector {
  private readonly deps: SeriesDetectorDeps

  constructor(deps: SeriesDetectorDeps) {
    this.deps = deps
  }

  /**
   * Candidates for one book, best first. Wikidata failing (offline, blocked)
   * falls back to Open Library quietly; only when both fail does it throw.
   */
  async detect({ work, edition }: DetectInput, signal?: AbortSignal): Promise<SeriesCandidate[]> {
    const olids = [work, edition].filter((r): r is SourceRef => r?.source === 'openlibrary').map((r) => r.id)
    if (olids.length === 0) return []

    let wikidataError: unknown
    try {
      const found = await this.deps.wikidata.seriesFor(olids, signal)
      if (found.length) {
        return found.map((s) => ({
          name: s.name,
          position: s.position,
          totalBooks: s.totalBooks,
          wikidataId: s.wikidataId,
          origin: 'wikidata' as const,
          members: s.members.map((m) => ({ ...m })),
        }))
      }
    } catch (error) {
      if (signal?.aborted) throw error
      wikidataError = error
    }

    if (edition?.source === 'openlibrary') {
      try {
        const details = await this.deps.getEdition(edition)
        return (details?.series ?? []).map((hint) => ({ name: hint.name, position: hint.position, origin: 'openlibrary' as const, members: [] }))
      } catch (error) {
        if (wikidataError) throw error
      }
    }
    if (wikidataError) throw wikidataError
    return []
  }
}
