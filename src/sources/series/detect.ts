/**
 * Series detection: Wikidata first (reliable names, numbers and the other
 * books of the series), Open Library's edition series label as a fallback
 * hint. Both are suggestions the user can edit or remove.
 */
import { seriesKey } from '@/domain/series'

import type { EditionDetails, SeriesHint, SourceRef } from '../types'
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
  /** Titles of the book (the work's and the edition's), to match on Wikidata when it lacks the Open Library IDs. */
  titles?: readonly string[]
  authors?: readonly string[]
}

export interface SeriesDetectorDeps {
  wikidata: WikidataSeriesLookup
  getEdition: (edition: SourceRef) => Promise<EditionDetails | null>
  /** Other editions of the work, whose series labels fill in when this edition has none. */
  listEditions?: (work: SourceRef) => Promise<EditionDetails[]>
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
  async detect({ work, edition, titles = [], authors = [] }: DetectInput, signal?: AbortSignal): Promise<SeriesCandidate[]> {
    const olids = [work, edition].filter((r): r is SourceRef => r?.source === 'openlibrary').map((r) => r.id)
    if (olids.length === 0) return []

    let wikidataError: unknown
    try {
      const found = await this.deps.wikidata.seriesFor({ olids, titles, authors }, signal)
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

    let olError: unknown
    let hints: SeriesHint[] = []
    if (edition?.source === 'openlibrary') {
      try {
        hints = (await this.deps.getEdition(edition))?.series ?? []
      } catch (error) {
        olError = error
      }
    }
    // Most editions carry no series label, so look across the work's editions and take the most common one.
    if (hints.length === 0 && work?.source === 'openlibrary' && this.deps.listEditions) {
      try {
        hints = mostCommonSeries(await this.deps.listEditions(work))
        olError = undefined
      } catch (error) {
        olError ??= error
      }
    }
    if (hints.length) return hints.map((hint) => ({ name: hint.name, position: hint.position, origin: 'openlibrary' as const, members: [] }))
    if (wikidataError && olError) throw wikidataError
    return []
  }
}

/**
 * The series named most often across a work's editions, with the number
 * most of them give and the most common spelling of the name. Labels seen
 * on only one edition count too, since many works have just one labelled.
 */
export function mostCommonSeries(editions: readonly EditionDetails[]): SeriesHint[] {
  const groups = new Map<string, { names: Map<string, number>; positions: Map<number, number>; count: number }>()
  for (const edition of editions) {
    for (const hint of edition.series ?? []) {
      const key = seriesKey(hint.name)
      if (!key) continue
      const g = groups.get(key) ?? { names: new Map(), positions: new Map(), count: 0 }
      g.count++
      g.names.set(hint.name, (g.names.get(hint.name) ?? 0) + 1)
      if (hint.position !== undefined) g.positions.set(hint.position, (g.positions.get(hint.position) ?? 0) + 1)
      groups.set(key, g)
    }
  }
  const top = (m: Map<string | number, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0]
  const best = [...groups.values()].sort((a, b) => b.count - a.count || b.positions.size - a.positions.size)[0]
  if (!best) return []
  return [{ name: top(best.names) as string, position: top(best.positions) as number | undefined }]
}
