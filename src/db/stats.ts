import { buildStatsModel, type StatsModel } from '@/domain/stats'

import type { ReadhoundDB } from './schema'

/** Reads every table the stats need and joins them. Wrap in `useLiveQuery` to keep it live. */
export async function loadStatsModel(db: ReadhoundDB): Promise<StatsModel> {
  const [entries, editions, works, authors, reads, sessions, categories] = await Promise.all([
    db.entries.toArray(),
    db.editions.toArray(),
    db.works.toArray(),
    db.authors.toArray(),
    db.reads.toArray(),
    db.sessions.toArray(),
    db.categories.toArray(),
  ])
  return buildStatsModel({ entries, editions, works, authors, reads, sessions, categories })
}
