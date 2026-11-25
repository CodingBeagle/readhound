import { useLiveQuery } from 'dexie-react-hooks'

import { useServices } from '@/app/services'
import { loadStatsModel } from '@/db/stats'
import type { StatsModel } from '@/domain/stats'

/** The stats model, kept live as reading is logged. `undefined` while loading. */
export function useStatsModel(): StatsModel | undefined {
  const { db } = useServices()
  return useLiveQuery(() => loadStatsModel(db), [db])
}
