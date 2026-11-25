import 'fake-indexeddb/auto'

import { HttpClient } from '@/sources/http'
import { fixtureFetch } from '@/sources/openlibrary/fixtureFetch'
import { OpenLibrarySource } from '@/sources/openlibrary/OpenLibrarySource'

import { createBackup, parseBackup, restoreBackup } from './backup'
import type { Clock } from './clock'
import { LibraryRepository } from './library'
import { loadBook, loadLibrary, loadSeriesView, loadSeriesViews } from './queries'
import { ReadhoundDB } from './schema'
import { SeriesRepository } from './series'
import { scanLibraryForSeries } from './seriesScan'
import type { SeriesDetector } from '@/sources/series'

const clock: Clock = { now: () => new Date('2026-11-25T09:00:00Z'), timeZone: () => 'Europe/Copenhagen' }
const ol = new OpenLibrarySource(new HttpClient({ fetch: fixtureFetch, sleep: async () => {} }))

let db: ReadhoundDB
let library: LibraryRepository
let series: SeriesRepository
beforeEach(async () => {
  db = new ReadhoundDB(`test-${crypto.randomUUID()}`)
  await db.open()
  library = new LibraryRepository(db, clock)
  series = new SeriesRepository(db, clock)
})
afterEach(async () => {
  await db.delete()
})

async function addBook(title: string, options: Parameters<LibraryRepository['addManual']>[1] = {}) {
  const { entryId } = await library.addManual({ title, authors: ['Jussi Adler-Olsen'], pageCount: 400 }, options)
  const entry = (await db.entries.get(entryId))!
  const edition = (await db.editions.get(entry.editionId))!
  return { entryId, workId: edition.workId, editionId: edition.id }
}

describe('series repository', () => {
  it('puts works in a series by position and shows progress', async () => {
    const q = await series.createSeries({ name: 'Afdeling Q', totalBooks: 10 })
    const one = await addBook('Kvinden i buret', { status: 'finished', startedOn: '2026-01-01', endedOn: '2026-01-10' })
    const two = await addBook('Fasandræberne')
    await series.setWorkSeries(two.workId, q, { position: 2 })
    await series.setWorkSeries(one.workId, q, { position: 1 })
    await series.addMissingMember(q, { title: 'Flaskepost fra P', position: 3 })

    const view = (await loadSeriesView(db, q))!
    expect(view.members.map((m) => [m.title, m.state])).toEqual([
      ['Kvinden i buret', 'finished'],
      ['Fasandræberne', 'to_read'],
      ['Flaskepost fra P', 'missing'],
    ])
    expect(view).toMatchObject({ total: 10, finished: 1, owned: 2, complete: false })
    expect(view.next?.title).toBe('Fasandræberne')

    const [book] = (await loadLibrary(db)).filter((b) => b.entry.id === two.entryId)
    expect(book!.series).toMatchObject([{ series: { name: 'Afdeling Q' }, position: 2 }])
    expect((await loadBook(db, two.entryId))!.book.series[0]!.position).toBe(2)
  })

  it('moves a work that is already in the series instead of adding it twice', async () => {
    const q = await series.createSeries({ name: 'Afdeling Q' })
    const { workId } = await addBook('Kvinden i buret')
    await series.setWorkSeries(workId, q, { position: 2 })
    await series.setWorkSeries(workId, q, { position: 1 })
    const members = await series.members(q)
    expect(members).toHaveLength(1)
    expect(members[0]!.position).toBe(1)
  })

  it('takes over a matching not-owned member when the book is placed in the series', async () => {
    const q = await series.createSeries({ name: 'Afdeling Q' })
    await series.addMissingMember(q, { title: 'Fasandræberne', position: 2 })
    const { workId } = await addBook('Fasandræberne')
    await series.setWorkSeries(workId, q, { position: 2 })
    const members = await series.members(q)
    expect(members).toHaveLength(1)
    expect(members[0]!.workId).toBe(workId)
  })

  it('links a not-owned member when that book is added from Open Library', async () => {
    const s = await series.createSeries({ name: 'Hail Mary' })
    await series.addMissingMember(s, { title: 'Project Hail Mary', position: 1, olWorkId: 'OL21745884W' })
    const edition = (await ol.lookupIsbn('9780593135204'))!
    await library.addFromSource({ edition })
    const [member] = await series.members(s)
    expect(member!.workId).toBeDefined()
    expect((await loadSeriesView(db, s))!.owned).toBe(1)
  })

  it('accepts decimal positions and rejects bad ones', async () => {
    const s = await series.createSeries({ name: 'Discworld' })
    const { workId } = await addBook('Troll Bridge')
    await series.setWorkSeries(workId, s, { position: 3.5 })
    expect((await series.members(s))[0]!.position).toBe(3.5)
    await expect(series.setWorkSeries(workId, s, { position: -1 })).rejects.toThrow()
    await expect(series.createSeries({ name: '  ' })).rejects.toThrow()
    await expect(series.createSeries({ name: 'X', totalBooks: 0 })).rejects.toThrow()
  })

  it('finds an existing series by folded name or Wikidata ID instead of duplicating it', async () => {
    const a = await series.findOrCreateSeries({ name: 'The Expanse', origin: 'openlibrary' })
    const b = await series.findOrCreateSeries({ name: 'Expanse', wikidataId: 'Q19610143', totalBooks: 9, origin: 'wikidata' })
    const c = await series.findOrCreateSeries({ name: 'The Expanse series', wikidataId: 'Q19610143', origin: 'wikidata' })
    expect(new Set([a, b, c]).size).toBe(1)
    expect(await db.series.get(a)).toMatchObject({ name: 'The Expanse', wikidataId: 'Q19610143', totalBooks: 9 })
  })

  it('keeps a series the user edited away from detection updates', async () => {
    const id = await series.findOrCreateSeries({ name: 'Expanse', origin: 'openlibrary' })
    await series.updateSeries(id, { name: 'The Expanse' })
    await series.findOrCreateSeries({ name: 'Expanse', totalBooks: 9, origin: 'wikidata' })
    expect(await db.series.get(id)).toMatchObject({ name: 'The Expanse', origin: 'manual', totalBooks: undefined })
  })

  it('deletes a series without touching the books', async () => {
    const s = await series.createSeries({ name: 'Afdeling Q' })
    const { workId } = await addBook('Kvinden i buret')
    await series.setWorkSeries(workId, s, { position: 1 })
    await series.deleteSeries(s)
    expect(await db.seriesMembers.count()).toBe(0)
    expect(await db.entries.count()).toBe(1)
  })

  it('keeps a removed book in its series as not owned', async () => {
    const s = await series.createSeries({ name: 'Afdeling Q' })
    const { workId, entryId } = await addBook('Kvinden i buret')
    await series.setWorkSeries(workId, s, { position: 1 })
    await library.deleteEntry(entryId)
    await library.pruneOrphans()
    const view = (await loadSeriesViews(db))[0]!
    expect(view.members.map((m) => [m.title, m.state])).toEqual([['Kvinden i buret', 'missing']])
  })
})

describe('series in backups', () => {
  it('round-trips series and members', async () => {
    const s = await series.createSeries({ name: 'Afdeling Q' })
    const { workId } = await addBook('Kvinden i buret')
    await series.setWorkSeries(workId, s, { position: 1 })
    await series.addMissingMember(s, { title: 'Fasandræberne', position: 2 })
    const backup = await createBackup(db, clock, '0.1.0')
    expect(backup.version).toBeGreaterThanOrEqual(2)

    const target = new ReadhoundDB(`test-${crypto.randomUUID()}`)
    await restoreBackup(target, parseBackup(JSON.stringify(backup)))
    expect((await createBackup(target, clock, '0.1.0')).data).toEqual(backup.data)
    await target.delete()
  })

  it('still imports version 1 backups, which have no series', async () => {
    await addBook('Kvinden i buret')
    const backup = await createBackup(db, clock, '0.1.0')
    const { series: _s, seriesMembers: _m, ...v1Data } = backup.data
    const parsed = parseBackup(JSON.stringify({ ...backup, version: 1, data: v1Data }))
    expect(parsed.data.series).toEqual([])
    await restoreBackup(db, parsed)
    expect(await db.entries.count()).toBe(1)
  })
})

describe('applying detected series', () => {
  const candidate = {
    name: 'Afdeling Q',
    position: 1,
    totalBooks: 10,
    wikidataId: 'Q1093045',
    origin: 'wikidata' as const,
    members: [
      { title: 'Kvinden i buret', position: 1, wikidataId: 'Q100', olWorkId: 'OL100W' },
      { title: 'Fasandræberne', position: 2, wikidataId: 'Q200', olWorkId: 'OL200W' },
      { title: 'Flaskepost fra P', position: 3, wikidataId: 'Q300' },
    ],
  }

  it('places the book and adds the rest of the series as not owned, once', async () => {
    const { workId } = await addBook('Kvinden i buret')
    const id = await series.applyCandidate(workId, candidate)
    await series.applyCandidate(workId, candidate)
    const view = (await loadSeriesView(db, id))!
    expect(view.members.map((m) => [m.title, m.member.position, m.state])).toEqual([
      ['Kvinden i buret', 1, 'to_read'],
      ['Fasandræberne', 2, 'missing'],
      ['Flaskepost fra P', 3, 'missing'],
    ])
    expect(view.series).toMatchObject({ wikidataId: 'Q1093045', totalBooks: 10, origin: 'wikidata' })
  })

  it('keeps a number the user set by hand', async () => {
    const { workId } = await addBook('Kvinden i buret')
    const s = await series.createSeries({ name: 'Afdeling Q' })
    await series.setWorkSeries(workId, s, { position: 7, origin: 'manual' })
    await series.applyCandidate(workId, candidate)
    const members = await series.members(s)
    expect(members.find((m) => m.workId === workId)!.position).toBe(7)
    expect(members).toHaveLength(3)
  })

  it('remembers dismissed suggestions', async () => {
    await series.dismissSuggestions('w1')
    await series.dismissSuggestions('w1')
    expect([...(await series.dismissedWorks())]).toEqual(['w1'])
  })
})

describe('scanning the library for series', () => {
  it('looks up each Open Library book without a series and applies the best match', async () => {
    const edition = (await ol.lookupIsbn('9780593135204'))!
    await library.addFromSource({ edition })
    await addBook('Manual book')
    const asked: unknown[] = []
    const detector = {
      detect: async (refs: unknown) => {
        asked.push(refs)
        return [{ name: 'Hail Mary', position: 1, origin: 'openlibrary' as const, members: [] }]
      },
    } as unknown as SeriesDetector
    const progress: number[] = []
    const result = await scanLibraryForSeries(db, series, detector, { onProgress: (p) => progress.push(p.done) })
    expect(result).toEqual({ found: 1, failed: 0 })
    expect(asked).toHaveLength(1)
    expect(progress).toEqual([0, 1])
    expect((await loadSeriesViews(db))[0]).toMatchObject({ series: { name: 'Hail Mary' }, owned: 1 })
    // A second scan has nothing left to do.
    expect(await scanLibraryForSeries(db, series, detector)).toEqual({ found: 0, failed: 0 })
  })

  it('counts failed lookups and carries on', async () => {
    const edition = (await ol.lookupIsbn('9780593135204'))!
    await library.addFromSource({ edition })
    const detector = { detect: async () => Promise.reject(new TypeError('offline')) } as unknown as SeriesDetector
    expect(await scanLibraryForSeries(db, series, detector)).toEqual({ found: 0, failed: 1 })
  })
})
