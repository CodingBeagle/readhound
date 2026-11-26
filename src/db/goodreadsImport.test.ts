import 'fake-indexeddb/auto'

import SAMPLE from '@/domain/__fixtures__/goodreads_library_export.csv?raw'
import { parseGoodreadsCsv } from '@/domain/goodreads'
import { HttpClient } from '@/sources/http'
import searchSmilla from '@/sources/openlibrary/__fixtures__/search-froken-smilla.json'
import { fixtureFetch } from '@/sources/openlibrary/fixtureFetch'
import { OpenLibrarySource } from '@/sources/openlibrary/OpenLibrarySource'
import { SourceRegistry } from '@/sources/registry'

import type { Clock } from './clock'
import { CollectionsRepository } from './collections'
import { chooseEdition, placeImportedSeries, planGoodreadsImport, runGoodreadsImport, sameBook } from './goodreadsImport'
import { LibraryRepository } from './library'
import { loadLibrary } from './queries'
import { ReadhoundDB } from './schema'
import { loadStatsModel } from './stats'
import { booksRead, pagesRead, timeToFinish } from '@/domain/stats'
import { SeriesRepository } from './series'

const clock: Clock = { now: () => new Date('2026-11-26T09:00:00Z'), timeZone: () => 'Europe/Copenhagen' }
const dbs: ReadhoundDB[] = []
async function newDb() {
  const db = new ReadhoundDB(`test-${crypto.randomUUID()}`)
  await db.open()
  dbs.push(db)
  return db
}
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
})

/** Recorded Open Library responses, plus the title search for Frøken Smilla (the ISBN isn't known there). */
const importFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.pathname === '/search.json' && url.searchParams.get('title')?.startsWith('Frøken Smilla'))
    return new Response(JSON.stringify(searchSmilla), { status: 200, headers: { 'Content-Type': 'application/json' } })
  return fixtureFetch(input, init)
}

function deps(db: ReadhoundDB, online = true) {
  const sources = new SourceRegistry([new OpenLibrarySource(new HttpClient({ fetch: importFetch, sleep: async () => {} }))])
  return {
    db,
    clock,
    library: new LibraryRepository(db, clock),
    collections: new CollectionsRepository(db, clock),
    sources: online ? sources : undefined,
    preferredLanguages: ['dan', 'eng'],
  }
}

const { books } = parseGoodreadsCsv(SAMPLE, '2026-11-26')

describe('Goodreads import', () => {
  it('imports the sample: Open Library matches by ISBN and title, the rest by hand', async () => {
    const db = await newDb()
    const progress: number[] = []
    const result = await runGoodreadsImport(deps(db), books, { onProgress: (p) => progress.push(p.done) })
    expect(result.failed).toEqual([])
    expect(result.imported).toHaveLength(7)
    expect(result.matched).toBe(2)
    expect(result.manual).toBe(5)
    expect(progress.at(-1)).toBe(7)

    const library = await loadLibrary(db)
    const categories = new Map((await db.categories.toArray()).map((c) => [c.id, c.name]))
    const genresOf = (b: (typeof library)[number]) => b.entry.categoryIds.map((id) => categories.get(id))
    const phm = library.find((b) => b.edition.title === 'Project Hail Mary')!
    expect(phm.edition.sourceRef).toEqual({ source: 'openlibrary', id: 'OL30036715M' })
    expect(phm.entry).toMatchObject({ status: 'finished', rating: 5, owned: true, favourite: true })
    expect(phm.entry.addedAt.slice(0, 10)).toBe('2024-02-01')
    expect(phm.reads.filter((r) => r.outcome === 'finished')).toHaveLength(2)
    expect(phm.reads.every((r) => r.startUnknown)).toBe(true)
    expect(genresOf(phm)).toEqual(['Science fiction'])

    const smilla = library.find((b) => b.edition.title.startsWith('Frøken Smilla'))!
    expect(smilla.edition.sourceRef?.source).toBe('openlibrary')
    expect(genresOf(smilla)).toEqual(['Crime & mystery'])

    const kings = library.find((b) => b.edition.title === 'The Way of Kings')!
    expect(kings.entry.status).toBe('reading')
    expect(kings.edition.format).toBe('ebook')
    expect(kings.reads).toMatchObject([{ startedOn: '2025-09-15' }])

    const silmarillion = library.find((b) => b.edition.title === 'The Silmarillion')!
    expect(silmarillion.entry.status).toBe('dnf')
    expect(silmarillion.reads).toMatchObject([{ outcome: 'dnf', endedOn: '2024-06-01' }])
    expect(silmarillion.authorNames).toEqual(['J.R.R. Tolkien', 'Christopher Tolkien'])

    const notes = await db.notes.toArray()
    expect(notes.map((n) => n.text).sort()).toEqual(['My Goodreads review:\n\nLoved every page.\n\nRocky is the best.', 'Too dense for a summer holiday.'])

    const lists = await db.lists.toArray()
    expect(lists.map((l) => l.name).sort()).toEqual(['Danske klassikere', 'Summer 2026'])
    expect(await db.listItems.where('listId').equals(lists.find((l) => l.name === 'Danske klassikere')!.id).count()).toBe(2)
  })

  it('counts imported finishes in the stats, but not their made-up time to finish', async () => {
    const db = await newDb()
    await runGoodreadsImport(deps(db, false), books)
    const model = await loadStatsModel(db)
    const year2024 = { from: '2024-01-01', to: '2024-12-31' }
    expect(booksRead(model, year2024)).toEqual({ total: 2, unique: 1 })
    expect(pagesRead(model, year2024)).toBe(476 * 2)
    expect(timeToFinish(model, { from: '2000-01-01', to: '2026-12-31' })).toEqual([])
  })

  it('adds everything by hand when offline, with the Goodreads details', async () => {
    const db = await newDb()
    const result = await runGoodreadsImport(deps(db, false), books)
    expect(result).toMatchObject({ matched: 0, manual: 7 })
    const phm = (await loadLibrary(db)).find((b) => b.edition.title === 'Project Hail Mary')!
    expect(phm.edition).toMatchObject({ isbn13: '9780593135204', pageCount: 476, publisher: 'Ballantine Books', format: 'hardcover' })
  })

  it('spots books already in the library and repeated rows', async () => {
    const db = await newDb()
    await new LibraryRepository(db, clock).addManual({ title: 'Kongens fald', authors: ['Johannes Vilhelm Jensen'] })
    await new LibraryRepository(db, clock).addManual({ title: 'Something else', authors: ['A. Writer'], isbn13: '9780593135204' })
    const plan = await planGoodreadsImport(db, [...books, books[2]!])
    expect(plan.toImport.map((b) => b.title)).not.toContain('Kongens Fald')
    expect(plan.toImport.map((b) => b.title)).not.toContain('Project Hail Mary')
    expect(plan.toImport).toHaveLength(5)
    expect(plan.duplicates).toHaveLength(3)
    expect(plan.duplicates.filter((d) => !d.entryId)).toHaveLength(1)
  })

  it('stops between books when cancelled, keeping what was imported', async () => {
    const db = await newDb()
    const controller = new AbortController()
    const result = await runGoodreadsImport(deps(db, false), books, {
      signal: controller.signal,
      onProgress: (p) => p.done === 2 && controller.abort(),
    })
    expect(result.imported).toHaveLength(2)
    expect(await db.entries.count()).toBe(2)
  })

  it('places books in their Goodreads series when detection finds none', async () => {
    const db = await newDb()
    const result = await runGoodreadsImport(deps(db, false), books)
    const series = new SeriesRepository(db, clock)
    const placed = await placeImportedSeries({ db, series }, result.imported)
    expect(placed).toEqual({ detected: 0, fromGoodreads: 2 })
    expect((await db.series.toArray()).map((s) => s.name).sort()).toEqual(['Farseer Trilogy', 'The Stormlight Archive'])
    expect((await db.seriesMembers.toArray()).every((m) => m.position === 1)).toBe(true)
  })
})

describe('matching helpers', () => {
  it('accepts a search hit only with the same main title and author', () => {
    const book = { title: 'Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch', authors: ['Terry Pratchett'] }
    expect(sameBook({ title: 'Good Omens', authors: [{ ref: { source: 'openlibrary', id: 'a' }, name: 'Terry Pratchett' }] }, book)).toBe(true)
    expect(sameBook({ title: 'Good Omens', authors: [{ ref: { source: 'openlibrary', id: 'a' }, name: 'Someone Else' }] }, book)).toBe(false)
    expect(sameBook({ title: 'Small Gods', authors: [{ ref: { source: 'openlibrary', id: 'a' }, name: 'Terry Pratchett' }] }, book)).toBe(false)
  })

  it('prefers the edition that matches the year, pages and format', () => {
    const edition = (id: string, extra: object) => ({ edition: { source: 'openlibrary' as const, id }, work: { source: 'openlibrary' as const, id: 'W' }, title: 'X', authors: [], isbn10: [], isbn13: [], publishers: [], subjects: [], ...extra })
    const pick = chooseEdition([edition('new', { publishYear: 2024, language: 'eng', pageCount: 300 }), edition('mine', { publishYear: 1996, pageCount: 435, format: 'Mass Market Paperback' })], books[5]!, ['eng'])
    expect(pick?.edition.id).toBe('mine')
  })
})
