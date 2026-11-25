import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'

import { useServices } from '@/app/services'
import { getSetting } from '@/db/queries'
import { DEFAULT_PREFERRED_LANGUAGES, pickEdition } from '@/domain/editions'
import { rankCandidates, seedsFor, tasteProfile, type Candidate, type Recommendation, type TasteProfile } from '@/domain/recommendations'
import type { SearchResult } from '@/sources/types'
import { useOnline } from '@/ui/hooks/useDebounced'
import { useStatsModel } from '@/ui/hooks/useStats'

/** Work ids of picks the reader said "not for me" to. Part of the backup like every setting. */
export const SETTING_DISMISSED_PICKS = 'recommendationsDismissed'

export type RecommendationsState =
  | { status: 'loading' }
  | { status: 'needRatings'; profile?: TasteProfile }
  | { status: 'offline'; profile: TasteProfile }
  | { status: 'error'; profile: TasteProfile; retry: () => void }
  | { status: 'ready'; profile: TasteProfile; picks: Recommendation[]; dismissedCount: number }

/**
 * Picks for the current library. The catalog searches depend only on the
 * profile's top authors and subjects, so logging a page or rating a book
 * re-ranks without fetching again; the HTTP cache keeps searches for a day.
 */
export function useRecommendations(limit = 12): RecommendationsState {
  const { db, sources } = useServices()
  const model = useStatsModel()
  const online = useOnline()
  const dismissed = useLiveQuery(() => getSetting<string[]>(db, SETTING_DISMISSED_PICKS, []), [db])
  const profile = useMemo(() => (model ? tasteProfile(model) : undefined), [model])
  const seeds = useMemo(() => (profile ? seedsFor(profile) : []), [profile])

  const candidates = useQuery({
    queryKey: ['recommendations', db.name, ...seeds.map((s) => `${s.kind}:${s.label}`)],
    enabled: online && seeds.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const found: Candidate[] = []
      let failures = 0
      // One search at a time: the HTTP client keeps to Open Library's rate limit anyway.
      for (const seed of seeds) {
        try {
          const outcome = await sources.search(seed.query, signal)
          if (outcome.kind === 'results') found.push(...outcome.results.map((result) => ({ result, seed })))
        } catch (error) {
          if (signal.aborted) throw error
          failures++
        }
      }
      if (failures === seeds.length) throw new Error('Open Library could not be reached')
      return found
    },
  })

  const picks = useMemo(
    () => (profile && candidates.data && dismissed ? rankCandidates(profile, candidates.data, { dismissed: new Set(dismissed), limit }) : undefined),
    [profile, candidates.data, dismissed, limit],
  )

  if (!profile || !dismissed) return { status: 'loading' }
  if (seeds.length === 0) return { status: 'needRatings', profile }
  if (picks) return { status: 'ready', profile, picks, dismissedCount: dismissed.length }
  if (!online) return { status: 'offline', profile }
  if (candidates.isError) return { status: 'error', profile, retry: () => void candidates.refetch() }
  return { status: 'loading' }
}

/** Actions on a pick: add it to To read with a well-chosen edition, or dismiss it. */
export function usePickActions() {
  const { db, sources, library, collections } = useServices()

  return {
    /** Resolves to the new entry id, or undefined when no edition could be found (the caller sends the reader to the edition picker). */
    async addToRead(result: SearchResult): Promise<string | undefined> {
      const source = sources.get('openlibrary')
      if (!source) return undefined
      const [editions, preferred] = await Promise.all([source.listEditions(result.work, { limit: 20 }), getSetting(db, 'preferredLanguages', DEFAULT_PREFERRED_LANGUAGES)])
      const edition = pickEdition(editions, preferred)
      if (!edition) return undefined
      const { entryId } = await library.addFromSource(
        { edition, work: { firstPublishYear: result.firstPublishYear, medianPageCount: result.medianPageCount, subjects: result.subjects }, fallbackCoverUrl: result.coverUrl },
        { status: 'to_read' },
      )
      return entryId
    },
    async dismiss(workId: string) {
      const current = await getSetting<string[]>(db, SETTING_DISMISSED_PICKS, [])
      if (!current.includes(workId)) await collections.setSetting(SETTING_DISMISSED_PICKS, [...current, workId])
    },
    async undismiss(workId: string) {
      const current = await getSetting<string[]>(db, SETTING_DISMISSED_PICKS, [])
      await collections.setSetting(
        SETTING_DISMISSED_PICKS,
        current.filter((id) => id !== workId),
      )
    },
    async resetDismissed() {
      await collections.setSetting(SETTING_DISMISSED_PICKS, [])
    },
  }
}
