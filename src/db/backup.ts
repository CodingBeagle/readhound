/**
 * Export and import (design doc, Storage and Data ownership): the complete
 * database as JSON, which imports back losslessly, and CSV files of the
 * library and reads for spreadsheets.
 */
import type { BookView } from '@/domain/bookView'
import { toCsv } from '@/domain/csv'
import type {
  Author,
  Category,
  CoverPhoto,
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

import type { Clock } from './clock'
import type { ReadhoundDB } from './schema'

export const BACKUP_FORMAT = 'readhound-backup'
/**
 * Version 2 added series, version 3 cover photos. Older files still import
 * (they simply have no series or cover photos).
 */
export const BACKUP_VERSION = 3

export const SETTING_LAST_BACKUP = 'lastBackupAt'
export const SETTING_BACKUP_SNOOZE = 'backupReminderSnoozedUntil'
export const SETTING_PREFERRED_LANGUAGES = 'preferredLanguages'

export interface BackupData {
  works: Work[]
  editions: Edition[]
  authors: Author[]
  entries: LibraryEntry[]
  reads: Read[]
  sessions: ReadingSession[]
  lists: List[]
  listItems: ListItem[]
  categories: Category[]
  notes: Note[]
  goals: Goal[]
  settings: Setting[]
  series: Series[]
  seriesMembers: SeriesMember[]
  covers: CoverPhoto[]
}

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  appVersion: string
  exportedAt: string
  data: BackupData
}

/** Tables in the backup, in import order. The Open Library response cache is left out: it is only a cache. */
export const BACKUP_TABLES = [
  'works',
  'editions',
  'authors',
  'entries',
  'reads',
  'sessions',
  'lists',
  'listItems',
  'categories',
  'notes',
  'goals',
  'settings',
  'series',
  'seriesMembers',
  'covers',
] as const satisfies readonly (keyof BackupData)[]

/** Primary key field per table, used to sanity-check rows on import. */
const KEY_FIELDS: Record<keyof BackupData, readonly string[]> = {
  works: ['id'],
  editions: ['id'],
  authors: ['id'],
  entries: ['id'],
  reads: ['id'],
  sessions: ['id'],
  lists: ['id'],
  listItems: ['listId', 'entryId'],
  categories: ['id'],
  notes: ['id'],
  goals: ['year'],
  settings: ['key'],
  series: ['id'],
  seriesMembers: ['id', 'seriesId'],
  covers: ['id', 'editionId', 'dataUrl'],
}

export async function createBackup(db: ReadhoundDB, clock: Clock, appVersion: string): Promise<Backup> {
  return db.transaction('r', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    const data = {} as Record<keyof BackupData, unknown[]>
    for (const table of BACKUP_TABLES) data[table] = await db.table(table).toArray()
    return { format: BACKUP_FORMAT, version: BACKUP_VERSION, appVersion, exportedAt: clock.now().toISOString(), data: data as unknown as BackupData }
  })
}

/** Records a finished export, which resets the backup reminder. */
export async function markBackedUp(db: ReadhoundDB, clock: Clock): Promise<void> {
  await db.settings.bulkPut([
    { key: SETTING_LAST_BACKUP, value: clock.now().toISOString() },
    { key: SETTING_BACKUP_SNOOZE, value: undefined },
  ])
}

export class BackupError extends Error {}

/** Parses and checks a backup file. Throws BackupError with a user-readable message. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new BackupError('This file is not valid JSON.')
  }
  const backup = raw as Partial<Backup> | null
  if (!backup || typeof backup !== 'object' || backup.format !== BACKUP_FORMAT) throw new BackupError('This is not a Readhound backup file.')
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION)
    throw new BackupError('This backup was made by a newer version of Readhound. Update the app and try again.')
  const data = backup.data as Partial<Record<keyof BackupData, unknown>> | undefined
  if (!data || typeof data !== 'object') throw new BackupError('The backup file has no data.')
  for (const table of BACKUP_TABLES) {
    const rows = data[table] ?? []
    if (!Array.isArray(rows)) throw new BackupError(`The backup file is damaged (${table}).`)
    for (const row of rows) {
      if (!row || typeof row !== 'object' || KEY_FIELDS[table].some((k) => (row as Record<string, unknown>)[k] === undefined))
        throw new BackupError(`The backup file is damaged (${table}).`)
    }
    data[table] = rows
  }
  return backup as Backup
}

export type BackupCounts = Record<'books' | 'reads' | 'sessions' | 'notes' | 'lists', number>

export function backupCounts(backup: Backup): BackupCounts {
  const d = backup.data
  return { books: d.entries.length, reads: d.reads.length, sessions: d.sessions.length, notes: d.notes.length, lists: d.lists.length }
}

/** Replaces everything on this device with the backup's contents, in one transaction. */
export async function restoreBackup(db: ReadhoundDB, backup: Backup): Promise<void> {
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const table of BACKUP_TABLES) {
      await db.table(table).clear()
      await db.table(table).bulkAdd(backup.data[table])
    }
  })
}

/**
 * Danger zone: empties every table of this database (books, reads, sessions,
 * notes, lists, categories, goals, settings and the Open Library cache).
 * Only the database passed in is touched, so the demo database is left alone.
 */
export async function clearEverything(db: ReadhoundDB): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
}

// ---------- CSV ----------

const joinNames = (names: readonly string[]) => names.join('; ')

/** One row per book in the library. */
export function libraryCsv(books: readonly BookView[], lists: readonly List[], listItems: readonly ListItem[], categories: readonly Category[]): string {
  const listName = new Map(lists.map((l) => [l.id, l.name]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const listsByEntry = new Map<string, string[]>()
  for (const item of listItems) {
    const name = listName.get(item.listId)
    if (name) listsByEntry.set(item.entryId, [...(listsByEntry.get(item.entryId) ?? []), name])
  }
  const header = [
    'Title', 'Subtitle', 'Authors', 'ISBN-13', 'ISBN-10', 'Publisher', 'Year', 'Pages', 'Language', 'Format',
    'Status', 'Owned', 'Rating', 'Added', 'Times finished', 'Last finished', 'Lists', 'Categories', 'Series',
  ]
  const rows = books.map((b) => {
    const e = b.edition
    return [
      e.title, e.subtitle, joinNames(b.authorNames), e.isbn13, e.isbn10, e.publisher, e.publishYear, e.pageCount, e.language, e.format,
      b.entry.status, b.entry.owned ? 'yes' : '', b.entry.rating, b.entry.addedAt.slice(0, 10),
      b.reads.filter((r) => r.outcome === 'finished').length, b.lastFinishedOn,
      joinNames(listsByEntry.get(b.entry.id) ?? []),
      joinNames(b.entry.categoryIds.flatMap((id) => categoryName.get(id) ?? [])),
      joinNames(b.series.map((s) => (s.position !== undefined ? `${s.series.name} #${s.position}` : s.series.name))),
    ]
  })
  return toCsv(header, rows)
}

/** One row per read (each attempt at a book), with its session totals. */
export function readsCsv(books: readonly BookView[], sessions: readonly ReadingSession[]): string {
  const byRead = new Map<string, ReadingSession[]>()
  for (const s of sessions) byRead.set(s.readId, [...(byRead.get(s.readId) ?? []), s])
  const header = ['Title', 'Authors', 'ISBN-13', 'Started', 'Ended', 'Outcome', 'Stopped at page', 'Pages read', 'Sessions', 'Minutes']
  const rows = books.flatMap((b) =>
    [...b.reads]
      .sort((x, y) => x.startedOn.localeCompare(y.startedOn))
      .map((r) => {
        const rs = byRead.get(r.id) ?? []
        const minutes = rs.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
        return [
          b.edition.title, joinNames(b.authorNames), b.edition.isbn13, r.startedOn, r.endedOn, r.outcome ?? 'in progress', r.stoppedAtPage,
          rs.reduce((sum, s) => sum + s.pagesRead, 0), rs.length, minutes || undefined,
        ]
      }),
  )
  return toCsv(header, rows)
}
