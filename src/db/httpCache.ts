import type { CacheEntry, ResponseCache } from '@/sources/http'

import type { ReadhoundDB } from './schema'

/** Keeps Open Library responses in IndexedDB so caching survives reloads. */
export class IndexedDbCache implements ResponseCache {
  private readonly database: ReadhoundDB
  constructor(database: ReadhoundDB) {
    this.database = database
  }
  async get(key: string): Promise<CacheEntry | undefined> {
    const row = await this.database.httpCache.get(key)
    return row ? { value: row.value, storedAt: row.storedAt } : undefined
  }
  async set(key: string, entry: CacheEntry): Promise<void> {
    await this.database.httpCache.put({ key, ...entry })
  }
}
