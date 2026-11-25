import Dexie, { type EntityTable } from 'dexie'

import type {
  Author,
  Category,
  Edition,
  Goal,
  LibraryEntry,
  List,
  ListItem,
  Note,
  Read,
  ReadingSession,
  Series,
  SeriesMember,
  Setting,
  Work,
} from '@/domain/types'
import type { CacheEntry } from '@/sources/http'

export interface HttpCacheRow extends CacheEntry {
  key: string
}

/** The local IndexedDB database. Screens and stats reach it only through the repositories in `db/`. */
export class ReadhoundDB extends Dexie {
  works!: EntityTable<Work, 'id'>
  editions!: EntityTable<Edition, 'id'>
  authors!: EntityTable<Author, 'id'>
  entries!: EntityTable<LibraryEntry, 'id'>
  reads!: EntityTable<Read, 'id'>
  sessions!: EntityTable<ReadingSession, 'id'>
  lists!: EntityTable<List, 'id'>
  listItems!: Dexie.Table<ListItem, [string, string]>
  categories!: EntityTable<Category, 'id'>
  notes!: EntityTable<Note, 'id'>
  goals!: EntityTable<Goal, 'year'>
  settings!: EntityTable<Setting, 'key'>
  httpCache!: EntityTable<HttpCacheRow, 'key'>
  series!: EntityTable<Series, 'id'>
  seriesMembers!: EntityTable<SeriesMember, 'id'>

  constructor(name = 'readhound') {
    super(name)
    // Works, editions and authors are unique by source reference (manual ones have none).
    this.version(1).stores({
      works: 'id, &[sourceRef.source+sourceRef.id], *authorIds',
      editions: 'id, workId, &[sourceRef.source+sourceRef.id], isbn13',
      authors: 'id, &[sourceRef.source+sourceRef.id]',
      entries: 'id, &editionId, status, addedAt',
      reads: 'id, entryId, endedOn',
      sessions: 'id, readId, startedAt',
      lists: 'id, sortOrder',
      listItems: '[listId+entryId], listId, entryId',
      categories: 'id, kind',
      notes: 'id, entryId, readId',
      goals: 'year',
      settings: 'key',
      httpCache: 'key',
    })
    // Series tracking: a series and its members, linked to works (design doc, Series).
    this.version(2).stores({
      series: 'id, name, wikidataId',
      seriesMembers: 'id, seriesId, workId, olWorkId, wikidataId',
    })
  }
}

export const db = new ReadhoundDB()

/** Asks the browser not to evict our data (design doc, Storage). */
export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false
}
