/** Read models for screens. Wrap these in `useLiveQuery` so screens update when data changes. */
import { buildBookView, type BookView } from '@/domain/bookView'

import type { ReadhoundDB } from './schema'

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

/** Every library entry joined with its edition, work, authors, reads and sessions. */
export async function loadLibrary(db: ReadhoundDB): Promise<BookView[]> {
  const [entries, editions, works, authors, reads, sessions] = await Promise.all([
    db.entries.toArray(),
    db.editions.toArray(),
    db.works.toArray(),
    db.authors.toArray(),
    db.reads.toArray(),
    db.sessions.toArray(),
  ])
  const editionById = new Map(editions.map((e) => [e.id, e]))
  const workById = new Map(works.map((w) => [w.id, w]))
  const authorById = new Map(authors.map((a) => [a.id, a]))
  const readsByEntry = groupBy(reads, (r) => r.entryId)
  const sessionsByRead = groupBy(sessions, (s) => s.readId)

  return entries.flatMap((entry) => {
    const edition = editionById.get(entry.editionId)
    if (!edition) return []
    const work = workById.get(edition.workId)
    const entryReads = readsByEntry.get(entry.id) ?? []
    return [
      buildBookView({
        entry,
        edition,
        work,
        authors: (work?.authorIds ?? []).flatMap((id) => authorById.get(id) ?? []),
        reads: entryReads,
        sessions: entryReads.flatMap((r) => sessionsByRead.get(r.id) ?? []),
      }),
    ]
  })
}

/** One entry as a BookView, plus all sessions of all its reads for the history. */
export async function loadBook(db: ReadhoundDB, entryId: string) {
  const entry = await db.entries.get(entryId)
  if (!entry) return null
  const edition = await db.editions.get(entry.editionId)
  if (!edition) return null
  const work = await db.works.get(edition.workId)
  const authors = (await db.authors.bulkGet(work?.authorIds ?? [])).filter((a) => a !== undefined)
  const reads = await db.reads.where('entryId').equals(entryId).toArray()
  const sessions = await db.sessions.where('readId').anyOf(reads.map((r) => r.id)).toArray()
  return { book: buildBookView({ entry, edition, work, authors, reads, sessions }), rawEdition: edition, sessions }
}

/** The library entry for a source edition, if it is already in the library. */
export async function findEntryBySourceEdition(db: ReadhoundDB, source: string, id: string) {
  const edition = await db.editions.where('[sourceRef.source+sourceRef.id]').equals([source, id]).first()
  return edition ? db.entries.where('editionId').equals(edition.id).first() : undefined
}

export async function getSetting<T>(db: ReadhoundDB, key: string, fallback: T): Promise<T> {
  return ((await db.settings.get(key))?.value as T | undefined) ?? fallback
}
