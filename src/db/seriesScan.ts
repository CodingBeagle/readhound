/**
 * "Find series for my library": runs series detection for every work that
 * has no series yet, applying what is found. Works the user dismissed
 * suggestions for, and manual works (nothing to look up), are skipped.
 */
import type { SeriesDetector } from '@/sources/series'
import type { SourceRef } from '@/sources/types'

import type { ReadhoundDB } from './schema'
import type { SeriesRepository } from './series'

export interface ScanProgress {
  done: number
  total: number
}

export interface ScanResult {
  /** Works placed in a series. */
  found: number
  /** Works whose lookup failed (offline, blocked). */
  failed: number
}

export async function scanLibraryForSeries(
  db: ReadhoundDB,
  repo: SeriesRepository,
  detector: SeriesDetector,
  options: { onProgress?: (p: ScanProgress) => void; signal?: AbortSignal } = {},
): Promise<ScanResult> {
  const [entries, editions, works, members, dismissed] = await Promise.all([
    db.entries.toArray(),
    db.editions.toArray(),
    db.works.toArray(),
    db.seriesMembers.toArray(),
    repo.dismissedWorks(),
  ])
  const inSeries = new Set(members.flatMap((m) => (m.workId ? [m.workId] : [])))
  const editionById = new Map(editions.map((e) => [e.id, e]))
  const workById = new Map(works.map((w) => [w.id, w]))
  const todo = new Map<string, { work?: SourceRef; edition?: SourceRef }>()
  for (const entry of entries) {
    const edition = editionById.get(entry.editionId)
    const work = edition && workById.get(edition.workId)
    if (!edition || !work || inSeries.has(work.id) || dismissed.has(work.id) || todo.has(work.id)) continue
    if (work.sourceRef?.source !== 'openlibrary' && edition.sourceRef?.source !== 'openlibrary') continue
    todo.set(work.id, { work: work.sourceRef, edition: edition.sourceRef })
  }

  let found = 0
  let failed = 0
  let done = 0
  options.onProgress?.({ done, total: todo.size })
  for (const [workId, refs] of todo) {
    options.signal?.throwIfAborted()
    // An earlier book's series may already have placed this one.
    const already = await db.seriesMembers.where('workId').equals(workId).count()
    if (!already) {
      try {
        const [best] = await detector.detect(refs, options.signal)
        if (best) {
          await repo.applyCandidate(workId, best)
          found++
        }
      } catch (error) {
        if (options.signal?.aborted) throw error
        failed++
      }
    }
    options.onProgress?.({ done: ++done, total: todo.size })
  }
  return { found, failed }
}
