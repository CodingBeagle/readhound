import { useLiveQuery } from 'dexie-react-hooks'

import { useServices } from '@/app/services'
import { loadSeriesView, loadSeriesViews } from '@/db/queries'
import type { SeriesView } from '@/domain/series'
import type { Series } from '@/domain/types'

/** Every series with progress, kept live. `undefined` while loading. */
export function useSeriesViews(): SeriesView[] | undefined {
  const { db } = useServices()
  return useLiveQuery(() => loadSeriesViews(db), [db])
}

/** One series, kept live; `null` when it doesn't exist. */
export function useSeriesView(seriesId: string): SeriesView | null | undefined {
  const { db } = useServices()
  return useLiveQuery(() => loadSeriesView(db, seriesId), [db, seriesId])
}

/** All series by name, for pickers and filters. */
export function useSeriesNames(): Series[] | undefined {
  const { db } = useServices()
  return useLiveQuery(async () => (await db.series.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' })), [db])
}
