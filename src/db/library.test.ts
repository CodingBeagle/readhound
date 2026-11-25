import 'fake-indexeddb/auto'

import { effective, isBorrowed } from '@/domain/effective'
import { HttpClient } from '@/sources/http'
import { fixtureFetch } from '@/sources/openlibrary/fixtureFetch'
import { OpenLibrarySource } from '@/sources/openlibrary/OpenLibrarySource'
import type { EditionDetails } from '@/sources/types'

import type { Clock } from './clock'
import { IndexedDbCache } from './httpCache'
import { LibraryRepository } from './library'
import { ReadhoundDB } from './schema'

let time = new Date('2026-11-25T09:00:00Z')
const clock: Clock = { now: () => time, timeZone: () => 'Europe/Copenhagen' }

let db: ReadhoundDB
let repo: LibraryRepository
const ol = new OpenLibrarySource(new HttpClient({ fetch: fixtureFetch, sleep: async () => {} }))

beforeEach(async () => {
  time = new Date('2026-11-25T09:00:00Z')
  db = new ReadhoundDB(`test-${crypto.randomUUID()}`)
  await db.open()
  repo = new LibraryRepository(db, clock)
})
afterEach(async () => {
  await db.delete()
})

async function projectHailMary() {
  const edition = await ol.lookupIsbn('9780593135204')
  return edition!
}

async function addReading(pageCount = 496) {
  const edition = await projectHailMary()
  const { entryId } = await repo.addFromSource({ edition: { ...edition, pageCount } }, { status: 'reading' })
  return entryId
}

describe('adding books', () => {
  it('adds a found book with title, author, page count and cover (acceptance 1)', async () => {
    const { entryId, existing } = await repo.addFromSource({ edition: await projectHailMary() })
    expect(existing).toBe(false)
    const entry = (await db.entries.get(entryId))!
    const edition = (await db.editions.get(entry.editionId))!
    const work = (await db.works.get(edition.workId))!
    const authors = await db.authors.bulkGet(work.authorIds)

    expect(entry).toMatchObject({ status: 'to_read', favourite: false, addedAt: '2026-11-25T09:00:00.000Z' })
    expect(edition).toMatchObject({
      title: 'Project Hail Mary',
      pageCount: 496,
      isbn13: '9780593135204',
      format: 'hardcover',
      language: 'eng',
      coverUrl: 'https://covers.openlibrary.org/b/id/12455001-M.jpg',
      sourceRef: { source: 'openlibrary', id: 'OL30036715M' },
    })
    expect(authors.map((a) => a?.name)).toEqual(['Andy Weir'])
  })

  it('opens the existing entry when the same edition is added again', async () => {
    const first = await repo.addFromSource({ edition: await projectHailMary() })
    const second = await repo.addFromSource({ edition: await projectHailMary() })
    expect(second).toEqual({ entryId: first.entryId, existing: true })
    expect(await db.entries.count()).toBe(1)
  })

  it('reuses the work and authors for another edition of the same work', async () => {
    const edition = await projectHailMary()
    await repo.addFromSource({ edition })
    await repo.addFromSource({ edition: { ...edition, edition: { source: 'openlibrary', id: 'OL999M' } } })
    expect(await db.editions.count()).toBe(2)
    expect(await db.works.count()).toBe(1)
    expect(await db.authors.count()).toBe(1)
  })

  it('borrows the work page count and another edition cover when missing, and marks them', async () => {
    const edition: EditionDetails = { ...(await projectHailMary()), pageCount: undefined, coverUrl: undefined }
    const { entryId } = await repo.addFromSource({
      edition,
      work: { medianPageCount: 480 },
      fallbackCoverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
    })
    const ed = (await db.editions.get((await db.entries.get(entryId))!.editionId))!
    expect(ed.pageCount).toBe(480)
    expect(ed.coverUrl).toBe('https://covers.openlibrary.org/b/id/1-M.jpg')
    expect(isBorrowed(ed, 'pageCount')).toBe(true)
    expect(isBorrowed(ed, 'coverUrl')).toBe(true)
  })

  it('saves a manual book with only title and author, and it can be tracked (acceptance 3)', async () => {
    const { entryId } = await repo.addManual({ title: 'Et lille ukendt digt', authors: ['Ukendt Forfatter'] }, { status: 'reading' })
    const result = await repo.logPage(entryId, 20)
    expect(result.ok).toBe(true)
    const edition = (await db.editions.get((await db.entries.get(entryId))!.editionId))!
    expect(edition.sourceRef).toBeUndefined()
  })

  it('requires a title and an author for manual books', async () => {
    await expect(repo.addManual({ title: ' ', authors: ['A'] })).rejects.toThrow(/title/)
    await expect(repo.addManual({ title: 'T', authors: [] })).rejects.toThrow(/author/)
  })

  it('adds a manual edition under an existing work ("Can\'t find my edition")', async () => {
    const { entryId } = await repo.addFromSource({ edition: await projectHailMary() })
    const workId = (await db.editions.get((await db.entries.get(entryId))!.editionId))!.workId
    await repo.addManual({ title: 'Project Hail Mary (Danish)', authors: [], workId, language: 'dan' })
    expect(await db.works.count()).toBe(1)
    expect(await db.editions.where('workId').equals(workId).count()).toBe(2)
  })

  it('creates a finished read when added as finished, and puts it in lists', async () => {
    const { entryId } = await repo.addFromSource(
      { edition: await projectHailMary() },
      { status: 'finished', startedOn: '2026-10-01', endedOn: '2026-10-20', listIds: ['l1'], categoryIds: ['c1'] },
    )
    const reads = await db.reads.where('entryId').equals(entryId).toArray()
    expect(reads).toMatchObject([{ startedOn: '2026-10-01', endedOn: '2026-10-20', outcome: 'finished' }])
    expect(await db.listItems.get(['l1', entryId])).toMatchObject({ position: 0 })
    expect((await db.entries.get(entryId))!.categoryIds).toEqual(['c1'])
  })
})

describe('owning', () => {
  it('marks a book as owned when adding it, with any status, and can change it later', async () => {
    const { entryId } = await repo.addFromSource({ edition: await projectHailMary() }, { status: 'finished', owned: true })
    expect(await db.entries.get(entryId)).toMatchObject({ status: 'finished', owned: true })
    await repo.changeStatus(entryId, 'reading')
    expect((await db.entries.get(entryId))!.owned).toBe(true) // a status change keeps it
    await repo.setOwned(entryId, false)
    expect((await db.entries.get(entryId))!.owned).toBe(false)
  })

  it('adds books as not owned by default', async () => {
    const { entryId } = await repo.addManual({ title: 'Lånt fra biblioteket', authors: ['Nogen'] })
    expect((await db.entries.get(entryId))!.owned).toBe(false)
  })
})

describe('editing', () => {
  it('keeps a page count edit after a refresh from Open Library (acceptance 4)', async () => {
    const { entryId } = await repo.addFromSource({ edition: await projectHailMary() })
    const editionId = (await db.entries.get(entryId))!.editionId
    await repo.editEdition(editionId, { pageCount: 512 })
    await repo.refreshEdition(editionId, (await ol.getEdition({ source: 'openlibrary', id: 'OL30036715M' }))!)

    const edition = (await db.editions.get(editionId))!
    expect(effective(edition, 'pageCount')).toBe(512)
    expect(edition.pageCount).toBe(496)

    await repo.editEdition(editionId, { pageCount: null })
    expect(effective((await db.editions.get(editionId))!, 'pageCount')).toBe(496)
  })
})

describe('status changes', () => {
  it('to_read → reading → finished tops up the last session to the page count', async () => {
    const { entryId } = await repo.addFromSource({ edition: await projectHailMary() })
    expect(await repo.changeStatus(entryId, 'reading')).toEqual({ ok: true, status: 'reading' })
    await repo.logPage(entryId, 400)
    expect(await repo.changeStatus(entryId, 'finished')).toEqual({ ok: true, status: 'finished' })

    const [read] = await db.reads.where('entryId').equals(entryId).toArray()
    expect(read).toMatchObject({ startedOn: '2026-11-25', endedOn: '2026-11-25', outcome: 'finished' })
    const sessions = await db.sessions.where('readId').equals(read!.id).sortBy('toPage')
    expect(sessions.map((s) => [s.fromPage, s.toPage])).toEqual([
      [0, 400],
      [400, 496],
    ])
  })

  it('reading → dnf stores the stop page; starting again creates a new read (acceptance 5)', async () => {
    const entryId = await addReading()
    await repo.logPage(entryId, 85)
    await repo.changeStatus(entryId, 'dnf')
    await repo.changeStatus(entryId, 'reading')

    const reads = await db.reads.where('entryId').equals(entryId).toArray()
    expect(reads).toHaveLength(2)
    expect(reads.find((r) => r.outcome === 'dnf')).toMatchObject({ stoppedAtPage: 85 })
    expect(reads.filter((r) => r.outcome === undefined)).toHaveLength(1)
    expect((await db.entries.get(entryId))!.status).toBe('reading')
  })

  it('reading → to_read is refused once sessions exist', async () => {
    const entryId = await addReading()
    expect(await repo.changeStatus(entryId, 'to_read')).toEqual({ ok: true, status: 'to_read' })
    expect(await db.reads.count()).toBe(0)

    await repo.changeStatus(entryId, 'reading')
    await repo.logPage(entryId, 10)
    expect(await repo.changeStatus(entryId, 'to_read')).toEqual({ ok: false, reason: 'has_sessions_mark_dnf' })
    expect((await db.entries.get(entryId))!.status).toBe('reading')
  })

  it('a reread after finishing keeps the earlier read', async () => {
    const entryId = await addReading()
    await repo.changeStatus(entryId, 'finished')
    time = new Date('2027-03-01T09:00:00Z')
    await repo.changeStatus(entryId, 'reading')
    const reads = await db.reads.where('entryId').equals(entryId).sortBy('startedOn')
    expect(reads.map((r) => [r.startedOn, r.outcome])).toEqual([
      ['2026-11-25', 'finished'],
      ['2027-03-01', undefined],
    ])
  })
})

describe('reading sessions', () => {
  it('logging page 120 then 180 creates sessions of 120 and 60 pages (acceptance 6)', async () => {
    const entryId = await addReading()
    await repo.logPage(entryId, 120)
    time = new Date('2026-11-26T20:00:00Z')
    const second = await repo.logPage(entryId, 180)
    expect(second.ok).toBe(true)
    const sessions = await db.sessions.orderBy('startedAt').toArray()
    expect(sessions.map((s) => s.pagesRead)).toEqual([120, 60])
    expect(sessions[0]).toMatchObject({ fromPage: 0, toPage: 120, timeZone: 'Europe/Copenhagen' })
  })

  it('rejects going backwards and pages beyond the end', async () => {
    const entryId = await addReading(300)
    await repo.logPage(entryId, 120)
    expect(await repo.logPage(entryId, 100)).toMatchObject({ ok: false, error: { code: 'behind_previous' } })
    expect(await repo.logPage(entryId, 301)).toMatchObject({ ok: false, error: { code: 'beyond_page_count' } })
  })

  it('reports reaching the last page so the UI can offer "Mark as finished?"', async () => {
    const entryId = await addReading(300)
    expect(await repo.logPage(entryId, 300)).toMatchObject({ ok: true, reachedEnd: true })
  })

  it('needs an open read', async () => {
    const { entryId } = await repo.addFromSource({ edition: await projectHailMary() })
    expect(await repo.logPage(entryId, 10)).toMatchObject({ ok: false, error: { code: 'no_open_read' } })
  })

  it('logs past reading with the full form, and sessions can be edited and deleted', async () => {
    const entryId = await addReading()
    const result = await repo.addSession(entryId, {
      fromPage: 0,
      toPage: 40,
      startedAt: '2026-11-20T19:00:00.000Z',
      durationMinutes: 45,
    })
    expect(result).toMatchObject({ ok: true, session: { pagesRead: 40, durationMinutes: 45 } })
    const id = result.ok ? result.session.id : ''
    await repo.updateSession(id, { toPage: 50 })
    expect((await db.sessions.get(id))!.pagesRead).toBe(50)
    await repo.deleteSession(id)
    expect(await db.sessions.count()).toBe(0)
  })
})

describe('deleting', () => {
  it('removes an entry with its reads, sessions, notes and list items, then prunes orphans', async () => {
    const entryId = await addReading()
    await repo.logPage(entryId, 50)
    await db.notes.add({ id: 'n', entryId, kind: 'quote', text: 'Amaze', createdAt: '', updatedAt: '' })
    await db.listItems.add({ listId: 'l', entryId, position: 0, addedAt: '' })

    await repo.deleteEntry(entryId)
    for (const table of [db.entries, db.reads, db.sessions, db.notes, db.listItems]) expect(await table.count()).toBe(0)

    expect(await db.editions.count()).toBe(1)
    await repo.pruneOrphans()
    expect(await db.editions.count()).toBe(0)
    expect(await db.works.count()).toBe(0)
    expect(await db.authors.count()).toBe(0)
  })
})

describe('IndexedDbCache', () => {
  it('stores and returns cached responses', async () => {
    const cache = new IndexedDbCache(db)
    await cache.set('https://x', { value: { a: 1 }, storedAt: 5 })
    expect(await cache.get('https://x')).toEqual({ value: { a: 1 }, storedAt: 5 })
    expect(await cache.get('https://y')).toBeUndefined()
  })
})
