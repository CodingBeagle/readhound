/**
 * Goodreads import (design doc, Goodreads import): spots books already in
 * the library, matches the rest to Open Library editions (ISBN first, then
 * title and author), falls back to manual books, and brings over statuses,
 * dated reads, ratings, shelves, owned copies and reviews. Afterwards the
 * series of the imported books are looked up, with the Goodreads series
 * label as the fallback.
 */
import { effectiveAuthorName, effectiveEdition } from '@/domain/effective'
import { orderEditions, pickEdition } from '@/domain/editions'
import { matchKey, titleAuthorKey, type GoodreadsBook } from '@/domain/goodreads'
import type { Note, Read } from '@/domain/types'
import { isbn10To13 } from '@/sources/isbn'
import type { SeriesDetector } from '@/sources/series'
import type { SourceRegistry } from '@/sources/registry'
import type { EditionDetails, SearchResult } from '@/sources/types'

import { newId, type Clock } from './clock'
import type { CollectionsRepository } from './collections'
import { applyGenres } from './genres'
import { normalizeFormat, type LibraryRepository } from './library'
import type { ReadhoundDB } from './schema'
import type { SeriesRepository } from './series'
import { scanLibraryForSeries } from './seriesScan'

export interface ImportDuplicate {
  book: GoodreadsBook
  /** The library entry it matches, or undefined when it repeats an earlier row of the file. */
  entryId?: string
}

export interface ImportPlan {
  toImport: GoodreadsBook[]
  duplicates: ImportDuplicate[]
}

const isbn13Of = (b: { isbn13?: string; isbn10?: string }) => b.isbn13 ?? (b.isbn10 ? isbn10To13(b.isbn10) : undefined)

/**
 * Splits the file into books to import and books already in the library
 * (same ISBN, or same title and first author's surname). Rows repeating an
 * earlier row are duplicates too.
 */
export async function planGoodreadsImport(db: ReadhoundDB, books: readonly GoodreadsBook[]): Promise<ImportPlan> {
  const [entries, editions, works, authors] = await Promise.all([db.entries.toArray(), db.editions.toArray(), db.works.toArray(), db.authors.toArray()])
  const editionById = new Map(editions.map((e) => [e.id, e]))
  const workById = new Map(works.map((w) => [w.id, w]))
  const authorById = new Map(authors.map((a) => [a.id, a]))
  const byIsbn = new Map<string, string>()
  const byKey = new Map<string, string>()
  for (const entry of entries) {
    const edition = editionById.get(entry.editionId)
    if (!edition) continue
    const e = effectiveEdition(edition)
    const isbn = isbn13Of({ isbn13: e.isbn13, isbn10: e.isbn10 })
    if (isbn) byIsbn.set(isbn, entry.id)
    const work = workById.get(edition.workId)
    const names = (work?.authorIds ?? []).flatMap((id) => {
      const a = authorById.get(id)
      return a ? [effectiveAuthorName(a)] : []
    })
    for (const title of new Set([e.title, work?.title].filter((x): x is string => !!x))) byKey.set(titleAuthorKey(title, names), entry.id)
  }

  const plan: ImportPlan = { toImport: [], duplicates: [] }
  const seenIsbn = new Set<string>()
  const seenKey = new Set<string>()
  for (const book of books) {
    const isbn = isbn13Of(book)
    const key = titleAuthorKey(book.title, book.authors)
    const entryId = (isbn && byIsbn.get(isbn)) || byKey.get(key)
    if (entryId) plan.duplicates.push({ book, entryId })
    else if ((isbn && seenIsbn.has(isbn)) || seenKey.has(key)) plan.duplicates.push({ book })
    else plan.toImport.push(book)
    if (isbn) seenIsbn.add(isbn)
    seenKey.add(key)
  }
  return plan
}

export interface ImportDeps {
  db: ReadhoundDB
  library: LibraryRepository
  collections: CollectionsRepository
  clock: Clock
  /** Open Library lookups; leave out to add every book by hand (offline, or the reader chose not to). */
  sources?: SourceRegistry
  preferredLanguages?: readonly string[]
}

export interface ImportProgress {
  done: number
  total: number
  /** The book being imported now. */
  current?: string
}

export interface ImportedBook {
  entryId: string
  workId: string
  /** The Goodreads series label, used when detection finds nothing. */
  series?: GoodreadsBook['series']
}

export interface ImportResult {
  imported: ImportedBook[]
  /** Matched to an Open Library edition. */
  matched: number
  /** Added from the Goodreads data alone. */
  manual: number
  /** Turned out to be in the library already once matched (same Open Library edition). */
  existing: number
  /** Open Library lookups that failed (offline, errors); those books were added by hand. */
  lookupFailed: number
  failed: { book: GoodreadsBook; message: string }[]
}

/** Imports the books one at a time; stops between books when `signal` aborts, keeping what was imported. */
export async function runGoodreadsImport(
  deps: ImportDeps,
  books: readonly GoodreadsBook[],
  options: { onProgress?: (p: ImportProgress) => void; signal?: AbortSignal } = {},
): Promise<ImportResult> {
  const result: ImportResult = { imported: [], matched: 0, manual: 0, existing: 0, lookupFailed: 0, failed: [] }
  const listIds = await ensureLists(deps, books)
  let done = 0
  for (const [i, book] of books.entries()) {
    options.onProgress?.({ done: i, total: books.length, current: book.title })
    if (options.signal?.aborted) break
    try {
      let edition: EditionDetails | undefined
      let work: SearchResult | undefined
      if (deps.sources) {
        try {
          ;({ edition, work } = await findEdition(deps.sources, book, deps.preferredLanguages ?? []))
        } catch {
          if (options.signal?.aborted) break
          result.lookupFailed++
        }
      }
      const addOptions = { owned: book.owned, listIds: book.lists.map((l) => listIds.get(l.toLowerCase())!).filter(Boolean) }
      let added
      if (edition) {
        added = await deps.library.addFromSource(
          { edition, work: work && { firstPublishYear: work.firstPublishYear, medianPageCount: work.medianPageCount } },
          addOptions,
        )
        if (added.existing) {
          result.existing++
          continue
        }
        await fillGaps(deps, added.entryId, book, edition)
        result.matched++
      } else {
        added = await deps.library.addManual(
          {
            title: book.title,
            authors: book.authors,
            isbn13: book.isbn13,
            isbn10: book.isbn10,
            pageCount: book.pageCount,
            publisher: book.publisher,
            publishYear: book.publishYear,
            format: book.format,
          },
          addOptions,
        )
        result.manual++
      }
      const workId = await applyReading(deps, added.entryId, book)
      if (book.genres.length) await applyGenres(deps.db, deps.collections, added.entryId, book.genres)
      result.imported.push({ entryId: added.entryId, workId, series: book.series })
    } catch (error) {
      result.failed.push({ book, message: error instanceof Error ? error.message : String(error) })
    } finally {
      done = i + 1
    }
  }
  options.onProgress?.({ done, total: books.length })
  return result
}

/** Shelves become lists; an existing list with the same name (any case) is reused. */
async function ensureLists(deps: ImportDeps, books: readonly GoodreadsBook[]): Promise<Map<string, string>> {
  const ids = new Map((await deps.db.lists.toArray()).map((l) => [l.name.toLowerCase(), l.id]))
  for (const name of books.flatMap((b) => b.lists)) {
    const key = name.toLowerCase()
    if (!ids.has(key)) ids.set(key, await deps.collections.createList(name))
  }
  return ids
}

/** ISBN-13, then ISBN-10, then a title and author search checked against the row. */
export async function findEdition(
  sources: SourceRegistry,
  book: GoodreadsBook,
  preferred: readonly string[],
): Promise<{ edition?: EditionDetails; work?: SearchResult }> {
  for (const isbn of [book.isbn13, book.isbn10]) {
    if (!isbn) continue
    const hit = await sources.lookupIsbn(isbn)
    if (hit) return { edition: hit.edition }
  }
  const outcome = await sources.search({ title: book.title, author: book.authors[0], limit: 5 })
  if (outcome.kind === 'isbn') return { edition: outcome.edition }
  if (outcome.kind !== 'results') return {}
  const work = outcome.results.find((r) => sameBook(r, book))
  const source = work && sources.get(work.work.source)
  if (!work || !source) return {}
  const editions = await source.listEditions(work.work, { limit: 50 })
  return { edition: chooseEdition(editions, book, preferred), work }
}

/** A search hit is the row's book when the main titles agree and the first author's surname appears among its authors. */
export function sameBook(result: Pick<SearchResult, 'title' | 'authors'>, book: Pick<GoodreadsBook, 'title' | 'authors'>): boolean {
  const main = (t: string) => matchKey(t.split(/[:(]/)[0] ?? t)
  const a = main(result.title)
  const b = main(book.title)
  if (!a || !b || (a !== b && !a.startsWith(`${b} `) && !b.startsWith(`${a} `))) return false
  const surname = matchKey(book.authors[0] ?? '').split(' ').at(-1)
  return !surname || result.authors.some((x) => matchKey(x.name).split(' ').includes(surname))
}

/** The edition most like the row (publish year, pages, format, publisher); otherwise the usual one-tap pick. */
export function chooseEdition(editions: readonly EditionDetails[], book: GoodreadsBook, preferred: readonly string[]): EditionDetails | undefined {
  if (!editions.length) return undefined
  const score = (e: EditionDetails) =>
    (book.publishYear && e.publishYear === book.publishYear ? 2 : 0) +
    (book.pageCount && e.pageCount && Math.abs(e.pageCount - book.pageCount) <= 5 ? 2 : 0) +
    (book.format && normalizeFormat(e.format) === book.format ? 1 : 0) +
    (book.publisher && e.publishers.some((p) => matchKey(p) === matchKey(book.publisher!)) ? 1 : 0)
  const ordered = orderEditions(editions, preferred)
  const best = ordered.reduce((top, e) => (score(e) > score(top) ? e : top), ordered[0]!)
  return score(best) >= 3 ? best : pickEdition(editions, preferred)
}

/** Goodreads knows the reader's own copy: its page count fills a gap, its binding becomes the format. */
async function fillGaps(deps: ImportDeps, entryId: string, book: GoodreadsBook, details: EditionDetails) {
  const entry = await deps.db.entries.get(entryId)
  const edition = entry && (await deps.db.editions.get(entry.editionId))
  if (!edition) return
  const changes: Record<string, unknown> = {}
  if (book.pageCount && (edition.pageCount === undefined || edition.borrowed.pageCount)) changes.pageCount = book.pageCount
  if (book.format && book.format !== normalizeFormat(details.format)) changes.format = book.format
  if (Object.keys(changes).length) await deps.library.editEdition(edition.id, changes)
}

/** Status, dates, reads, rating, favourite and notes. Returns the work id. */
async function applyReading(deps: ImportDeps, entryId: string, book: GoodreadsBook): Promise<string> {
  const { db } = deps
  return db.transaction('rw', [db.entries, db.editions, db.works, db.reads, db.notes], async () => {
    const entry = (await db.entries.get(entryId))!
    const edition = (await db.editions.get(entry.editionId))!
    // The day as an instant at local noon, so it shows as the same date in any nearby time zone.
    const addedAt = new Date(`${book.addedOn}T12:00:00`).toISOString()
    const reads: Read[] = book.reads.map((r) => ({
      id: newId(),
      entryId,
      startedOn: r.startedOn,
      ...(r.endedOn && { endedOn: r.endedOn }),
      ...(r.outcome && { outcome: r.outcome }),
      ...(r.startUnknown && { startUnknown: true }),
    }))
    await db.reads.where('entryId').equals(entryId).delete()
    await db.reads.bulkAdd(reads)
    const lastDate = reads.map((r) => r.endedOn ?? r.startedOn).sort().at(-1)
    await db.entries.update(entryId, {
      status: book.status,
      addedAt,
      statusChangedAt: lastDate && lastDate > book.addedOn ? new Date(`${lastDate}T12:00:00`).toISOString() : addedAt,
      rating: book.rating,
      favourite: book.favourite,
    })
    if (book.firstPublishYear) {
      const work = await db.works.get(edition.workId)
      if (work && (work.firstPublishYear === undefined || book.firstPublishYear < work.firstPublishYear)) await db.works.update(work.id, { firstPublishYear: book.firstPublishYear })
    }
    const lastFinished = reads.filter((r) => r.outcome).at(-1)
    const now = deps.clock.now().toISOString()
    const note = (text: string): Note => ({ id: newId(), entryId, readId: lastFinished?.id, kind: 'note', text, createdAt: now, updatedAt: now })
    if (book.review) await db.notes.add(note(`My Goodreads review:\n\n${book.review}`))
    if (book.privateNotes) await db.notes.add(note(book.privateNotes))
    return edition.workId
  })
}

export interface SeriesStepResult {
  /** Works placed in a series by detection. */
  detected: number
  /** Works placed in their Goodreads series because detection found none. */
  fromGoodreads: number
}

/**
 * After an import: looks up series for the imported books (when online), then puts
 * imported books detection didn't place into the series Goodreads names.
 */
export async function placeImportedSeries(
  deps: { db: ReadhoundDB; series: SeriesRepository; detector?: SeriesDetector },
  imported: readonly ImportedBook[],
  options: { onProgress?: (p: { done: number; total: number }) => void; signal?: AbortSignal } = {},
): Promise<SeriesStepResult> {
  let detected = 0
  if (deps.detector) detected = (await scanLibraryForSeries(deps.db, deps.series, deps.detector, { ...options, workIds: new Set(imported.map((b) => b.workId)) })).found
  let fromGoodreads = 0
  for (const book of imported) {
    if (!book.series || options.signal?.aborted) continue
    if (await deps.db.seriesMembers.where('workId').equals(book.workId).count()) continue
    const seriesId = await deps.series.findOrCreateSeries({ name: book.series.name, origin: 'manual' })
    await deps.series.setWorkSeries(book.workId, seriesId, { position: book.series.position, origin: 'manual' })
    fromGoodreads++
  }
  return { detected, fromGoodreads }
}
