import 'fake-indexeddb/auto'

import { isBackupDue } from '@/domain/backup'
import { toCsv } from '@/domain/csv'

import { BackupError, backupCounts, clearEverything, createBackup, libraryCsv, markBackedUp, parseBackup, readsCsv, restoreBackup } from './backup'
import type { Clock } from './clock'
import { CollectionsRepository } from './collections'
import { LibraryRepository } from './library'
import { loadLibrary } from './queries'
import { ReadhoundDB } from './schema'

let time = new Date('2026-11-25T09:00:00Z')
const clock: Clock = { now: () => time, timeZone: () => 'Europe/Copenhagen' }
const dbs: ReadhoundDB[] = []
async function newDb() {
  const db = new ReadhoundDB(`test-${crypto.randomUUID()}`)
  await db.open()
  dbs.push(db)
  return db
}
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
  time = new Date('2026-11-25T09:00:00Z')
})

async function seed(db: ReadhoundDB) {
  const library = new LibraryRepository(db, clock)
  const collections = new CollectionsRepository(db, clock)
  const list = await collections.createList('Danske klassikere')
  const genre = await collections.createCategory({ name: 'Krimi', kind: 'genre', isFiction: true })
  const { entryId } = await library.addManual(
    { title: 'Frøken Smillas fornemmelse for sne', authors: ['Peter Høeg'], pageCount: 435, isbn13: '9788702034516' },
    { status: 'reading', listIds: [list], categoryIds: [genre] },
  )
  await library.logPage(entryId, 120)
  time = new Date('2026-11-26T09:00:00Z')
  await library.logPage(entryId, 180)
  await collections.addNote(entryId, { kind: 'quote', text: 'Jeg har en fornemmelse for sne, "siger" hun', page: 33 })
  await collections.setGoal({ year: 2026, targetBooks: 25 })
  await collections.setSetting('preferredLanguages', ['dan', 'eng'])
  return { entryId }
}

describe('JSON backup', () => {
  it('round-trips everything losslessly into another database', async () => {
    const source = await newDb()
    await seed(source)
    const backup = await createBackup(source, clock, '0.1.0')
    const text = JSON.stringify(backup)

    const target = await newDb()
    await new LibraryRepository(target, clock).addManual({ title: 'Will be replaced', authors: ['Y'] })
    const parsed = parseBackup(text)
    expect(backupCounts(parsed)).toEqual({ books: 1, reads: 1, sessions: 2, notes: 1, lists: 1 })
    await restoreBackup(target, parsed)

    const again = await createBackup(target, clock, '0.1.0')
    expect(again.data).toEqual(backup.data)
  })

  it('leaves out the Open Library response cache', async () => {
    const db = await newDb()
    await db.httpCache.put({ key: 'k', body: '{}', storedAt: 0 } as never)
    const backup = await createBackup(db, clock, '0.1.0')
    expect(Object.keys(backup.data)).not.toContain('httpCache')
  })

  it('rejects files that are not Readhound backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup('{"hello":1}')).toThrow('not a Readhound backup')
    expect(() => parseBackup(JSON.stringify({ format: 'readhound-backup', version: 99, data: {} }))).toThrow('newer version')
    expect(() => parseBackup(JSON.stringify({ format: 'readhound-backup', version: 1, data: { entries: [{ status: 'reading' }] } }))).toThrow('damaged (entries)')
  })

  it('accepts a backup with missing tables as empty', () => {
    const backup = parseBackup(JSON.stringify({ format: 'readhound-backup', version: 1, appVersion: 'x', exportedAt: 'y', data: {} }))
    expect(backup.data.notes).toEqual([])
  })

  it('records the export time and clears a snooze', async () => {
    const db = await newDb()
    await db.settings.put({ key: 'backupReminderSnoozedUntil', value: '2026-12-01T00:00:00Z' })
    await markBackedUp(db, clock)
    expect((await db.settings.get('lastBackupAt'))?.value).toBe('2026-11-25T09:00:00.000Z')
    expect((await db.settings.get('backupReminderSnoozedUntil'))?.value).toBeUndefined()
  })
})

describe('danger zone', () => {
  it('empties every table, settings and cache included', async () => {
    const db = await newDb()
    await seed(db)
    await db.httpCache.put({ key: 'k', body: '{}', storedAt: 0 } as never)
    await clearEverything(db)
    for (const table of db.tables) expect(await table.count(), table.name).toBe(0)
  })

  it('leaves other databases alone', async () => {
    const mine = await newDb()
    const other = await newDb()
    await seed(other)
    await clearEverything(mine)
    expect(await other.entries.count()).toBe(1)
  })
})

describe('CSV export', () => {
  it('writes the library and reads with Danish letters, lists and categories', async () => {
    const db = await newDb()
    await seed(db)
    const books = await loadLibrary(db)
    const lib = libraryCsv(books, await db.lists.toArray(), await db.listItems.toArray(), await db.categories.toArray())
    const [header, row] = lib.replace('﻿', '').trim().split('\r\n')
    expect(header).toContain('Title,Subtitle,Authors')
    expect(row).toBe('Frøken Smillas fornemmelse for sne,,Peter Høeg,9788702034516,,,,435,,,reading,,2026-11-25,0,,Danske klassikere,Krimi,')

    const reads = readsCsv(books, await db.sessions.toArray()).trim().split('\r\n')
    expect(reads[1]).toBe('Frøken Smillas fornemmelse for sne,Peter Høeg,9788702034516,2026-11-25,,in progress,,180,2,')
  })

  it('quotes commas, quotes and newlines and defuses formulas', () => {
    expect(toCsv(['a'], [['x, "y"\nz'], ['=SUM(A1)'], [-3]])).toBe('﻿a\r\n"x, ""y""\nz"\r\n\'=SUM(A1)\r\n-3\r\n')
  })
})

describe('backup reminder', () => {
  const now = new Date('2027-01-31T12:00:00Z')
  it('is never due for an empty library', () => {
    expect(isBackupDue({ now })).toBe(false)
  })
  it('counts from the first book before the first export', () => {
    expect(isBackupDue({ now, oldestAddedAt: '2027-01-10T00:00:00Z' })).toBe(false)
    expect(isBackupDue({ now, oldestAddedAt: '2026-12-01T00:00:00Z' })).toBe(true)
  })
  it('is due more than 30 days after the last export, unless snoozed', () => {
    expect(isBackupDue({ now, oldestAddedAt: '2026-01-01T00:00:00Z', lastBackupAt: '2027-01-02T00:00:00Z' })).toBe(false)
    expect(isBackupDue({ now, oldestAddedAt: '2026-01-01T00:00:00Z', lastBackupAt: '2026-12-31T00:00:00Z' })).toBe(true)
    expect(isBackupDue({ now, oldestAddedAt: '2026-01-01T00:00:00Z', lastBackupAt: '2026-12-31T00:00:00Z', snoozedUntil: '2027-02-02T00:00:00Z' })).toBe(false)
  })
})
