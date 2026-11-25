/**
 * Library repository: adding books (from a source or by hand), editing
 * details, changing status and logging reading sessions. Every write that
 * touches several tables runs in one transaction.
 */
import { isImageDataUrl, isLocalCoverRef, localCoverRef } from '@/domain/covers'
import { effective } from '@/domain/effective'
import { currentPage, lastSession, validateSession, type SessionError } from '@/domain/sessions'
import { planTransition } from '@/domain/transitions'
import type {
  Author,
  EditableField,
  Edition,
  EditionFormat,
  LibraryEntry,
  Read,
  ReadingSession,
  SourceRef,
  Status,
  Work,
} from '@/domain/types'
import type { AuthorRef, EditionDetails, SearchResult } from '@/sources/types'

import { newId, systemClock, today, type Clock } from './clock'
import type { ReadhoundDB } from './schema'
import { linkWorkToMembers } from './series'

export interface AddOptions {
  /** Initial status, default `to_read`. */
  status?: Status
  /** For an initial `finished` status: dates asked from the user (default today). */
  startedOn?: string
  endedOn?: string
  listIds?: string[]
  categoryIds?: string[]
  /** I own a copy (default false). */
  owned?: boolean
}

export interface AddResult {
  entryId: string
  /** True when the edition was already in the library; the existing entry is returned. */
  existing: boolean
}

export interface AddFromSourceInput {
  edition: EditionDetails
  /** Work-level data from the search result, used for gaps such as the page count. */
  work?: Pick<SearchResult, 'firstPublishYear' | 'medianPageCount'> & { description?: string; subjects?: string[] }
  /** Cover of the first edition of the work that has one, used if this edition has none. */
  fallbackCoverUrl?: string
}

export interface ManualBookInput {
  title: string
  authors: string[]
  subtitle?: string
  isbn13?: string
  isbn10?: string
  pageCount?: number
  language?: string
  publisher?: string
  publishYear?: number
  format?: EditionFormat
  coverUrl?: string
  /** "Can't find my edition": create a manual edition under this existing work. */
  workId?: string
  /** A cover photo taken while adding the book; it wins over `coverUrl`. */
  coverPhoto?: CoverPhotoInput
}

/** A processed cover photo: a 2:3 JPEG data URL and its size. */
export interface CoverPhotoInput {
  dataUrl: string
  width: number
  height: number
}

export type ChangeStatusResult =
  | { ok: true; status: Status }
  | { ok: false; reason: 'has_sessions_mark_dnf' | 'no_change' | 'not_found' }

export type LogResult =
  | { ok: true; session: ReadingSession; reachedEnd: boolean }
  | { ok: false; error: SessionError | { code: 'no_open_read'; message: string } }

const FORMATS: Record<string, EditionFormat> = {
  hardcover: 'hardcover',
  paperback: 'paperback',
  'mass market paperback': 'paperback',
  'trade paperback': 'paperback',
  ebook: 'ebook',
  'e-book': 'ebook',
  audiobook: 'audiobook',
  'audio cd': 'audiobook',
}

/** Maps a source's free-text physical format to the app's formats. */
export function normalizeFormat(format: string | undefined): EditionFormat | undefined {
  if (!format) return undefined
  return FORMATS[format.trim().toLowerCase()] ?? 'other'
}

export class LibraryRepository {
  private readonly db: ReadhoundDB
  private readonly clock: Clock

  constructor(database: ReadhoundDB, clock: Clock = systemClock) {
    this.db = database
    this.clock = clock
  }

  private nowIso() {
    return this.clock.now().toISOString()
  }

  // ---------- Adding books ----------

  /** Adds a catalog edition, reusing existing work, author and edition records (deduplicated by source ref). */
  async addFromSource(input: AddFromSourceInput, options: AddOptions = {}): Promise<AddResult> {
    const { edition: details, work: workInfo, fallbackCoverUrl } = input
    const tables = [this.db.works, this.db.authors, this.db.editions, this.db.entries, this.db.reads, this.db.listItems, this.db.seriesMembers]
    return this.db.transaction('rw', tables, async () => {
      const existingEdition = await this.findBySourceRef('editions', details.edition)
      if (existingEdition) {
        const entry = await this.db.entries.where('editionId').equals(existingEdition.id).first()
        if (entry) return { entryId: entry.id, existing: true }
      }

      const authorIds = await this.upsertAuthors(details.authors)
      const workId = await this.upsertWork(details, authorIds, workInfo)
      // A series gap for this book (found by detection) now points at the owned work.
      await linkWorkToMembers(this.db, { id: workId, sourceRef: details.work, title: details.title })

      let editionId = existingEdition?.id
      if (!editionId) {
        const borrowPages = details.pageCount === undefined && workInfo?.medianPageCount !== undefined
        const borrowCover = details.coverUrl === undefined && fallbackCoverUrl !== undefined
        const edition: Edition = {
          id: newId(),
          workId,
          sourceRef: details.edition,
          title: details.title,
          subtitle: details.subtitle,
          isbn13: details.isbn13[0],
          isbn10: details.isbn10[0],
          publisher: details.publishers[0],
          publishYear: details.publishYear,
          pageCount: borrowPages ? workInfo?.medianPageCount : details.pageCount,
          language: details.language,
          format: normalizeFormat(details.format),
          coverUrl: borrowCover ? fallbackCoverUrl : details.coverUrl,
          borrowed: { ...(borrowPages && { pageCount: true }), ...(borrowCover && { coverUrl: true }) },
          overrides: {},
          fetchedAt: this.nowIso(),
        }
        await this.db.editions.add(edition)
        editionId = edition.id
      }
      return this.createEntry(editionId, options)
    })
  }

  /** Manual entry: title and at least one author are required, everything else is optional. */
  async addManual(input: ManualBookInput, options: AddOptions = {}): Promise<AddResult> {
    const title = input.title.trim()
    const names = input.authors.map((a) => a.trim()).filter(Boolean)
    if (!title) throw new Error('A title is required.')
    if (names.length === 0 && !input.workId) throw new Error('At least one author is required.')

    if (input.coverPhoto && !isImageDataUrl(input.coverPhoto.dataUrl)) throw new Error('A cover photo must be an image.')

    return this.db.transaction('rw', [this.db.works, this.db.authors, this.db.editions, this.db.entries, this.db.reads, this.db.listItems, this.db.covers], async () => {
      let workId = input.workId
      if (!workId) {
        const authorIds: string[] = []
        for (const name of names) {
          const author: Author = { id: newId(), name, overrides: {} }
          await this.db.authors.add(author)
          authorIds.push(author.id)
        }
        const work: Work = { id: newId(), title, authorIds, subjects: [] }
        await this.db.works.add(work)
        workId = work.id
      }
      const edition: Edition = {
        id: newId(),
        workId,
        title,
        subtitle: input.subtitle,
        isbn13: input.isbn13,
        isbn10: input.isbn10,
        publisher: input.publisher,
        publishYear: input.publishYear,
        pageCount: input.pageCount,
        language: input.language,
        format: input.format,
        coverUrl: input.coverUrl,
        borrowed: {},
        overrides: {},
      }
      await this.db.editions.add(edition)
      if (input.coverPhoto) await this.storeCoverPhoto(edition, input.coverPhoto)
      return this.createEntry(edition.id, options)
    })
  }

  private async createEntry(editionId: string, options: AddOptions): Promise<AddResult> {
    const now = this.nowIso()
    const status = options.status ?? 'to_read'
    const entry: LibraryEntry = {
      id: newId(),
      editionId,
      status,
      addedAt: now,
      statusChangedAt: now,
      categoryIds: options.categoryIds ?? [],
      favourite: false,
      owned: options.owned ?? false,
    }
    await this.db.entries.add(entry)

    const plan = planTransition({
      from: null,
      to: status,
      today: today(this.clock),
      startedOn: options.startedOn,
      endedOn: options.endedOn,
    })
    if (plan.ok) {
      for (const change of plan.changes) {
        if (change.kind === 'createRead') await this.db.reads.add({ id: newId(), entryId: entry.id, ...change.read })
      }
    }

    for (const listId of options.listIds ?? []) {
      const position = await this.db.listItems.where('listId').equals(listId).count()
      await this.db.listItems.add({ listId, entryId: entry.id, position, addedAt: now })
    }
    return { entryId: entry.id, existing: false }
  }

  private async upsertAuthors(authors: AuthorRef[]): Promise<string[]> {
    const ids: string[] = []
    for (const a of authors) {
      const existing = await this.findBySourceRef('authors', a.ref)
      if (existing) {
        if (existing.name !== a.name) await this.db.authors.update(existing.id, { name: a.name })
        ids.push(existing.id)
      } else {
        const author: Author = { id: newId(), sourceRef: a.ref, name: a.name, overrides: {} }
        await this.db.authors.add(author)
        ids.push(author.id)
      }
    }
    return ids
  }

  private async upsertWork(details: EditionDetails, authorIds: string[], info: AddFromSourceInput['work']): Promise<string> {
    const existing = await this.findBySourceRef('works', details.work)
    if (existing) return existing.id
    const work: Work = {
      id: newId(),
      sourceRef: details.work,
      title: details.title,
      authorIds,
      firstPublishYear: info?.firstPublishYear,
      subjects: info?.subjects ?? details.subjects,
      description: info?.description ?? details.description,
      medianPageCount: info?.medianPageCount,
      fetchedAt: this.nowIso(),
    }
    await this.db.works.add(work)
    return work.id
  }

  private findBySourceRef<T extends 'works' | 'editions' | 'authors'>(table: T, ref: SourceRef) {
    return (this.db[table] as ReadhoundDB['works'] | ReadhoundDB['editions'] | ReadhoundDB['authors'])
      .where('[sourceRef.source+sourceRef.id]')
      .equals([ref.source, ref.id])
      .first() as Promise<(T extends 'works' ? Work : T extends 'editions' ? Edition : Author) | undefined>
  }

  // ---------- Editing ----------

  /** Stores user edits as overrides. Pass `null` to clear an override and fall back to the source value. */
  async editEdition(editionId: string, changes: Partial<Record<EditableField, unknown>>): Promise<void> {
    await this.db.transaction('rw', [this.db.editions, this.db.covers], async () => {
      const edition = await this.db.editions.get(editionId)
      if (!edition) throw new Error(`Edition ${editionId} not found`)
      // A new cover address replaces the cover photo, which is then no longer needed.
      if (changes.coverUrl !== undefined && changes.coverUrl !== edition.overrides.coverUrl) await this.db.covers.where('editionId').equals(editionId).delete()
      const overrides = { ...edition.overrides }
      for (const [field, value] of Object.entries(changes) as [EditableField, unknown][]) {
        if (value === null) delete overrides[field]
        else overrides[field] = value
      }
      await this.db.editions.update(editionId, { overrides })
    })
  }

  // ---------- Cover photos ----------

  /**
   * Sets a cover photo for the book (design doc, Cover photos). It is shown
   * through the `coverUrl` override, so the source cover is kept and comes
   * back when the photo is removed. A new photo replaces the old one.
   */
  async setCoverPhoto(entryId: string, photo: CoverPhotoInput): Promise<void> {
    if (!isImageDataUrl(photo.dataUrl)) throw new Error('A cover photo must be an image.')
    await this.db.transaction('rw', [this.db.entries, this.db.editions, this.db.covers], async () => {
      const edition = await this.entryEdition(entryId)
      await this.db.covers.where('editionId').equals(edition.id).delete()
      await this.storeCoverPhoto(edition, photo)
    })
  }

  /** Removes the cover photo; the book shows its source cover again (or the placeholder). */
  async removeCoverPhoto(entryId: string): Promise<void> {
    await this.db.transaction('rw', [this.db.entries, this.db.editions, this.db.covers], async () => {
      const edition = await this.entryEdition(entryId)
      await this.db.covers.where('editionId').equals(edition.id).delete()
      if (isLocalCoverRef(edition.overrides.coverUrl as string | undefined)) {
        const overrides = { ...edition.overrides }
        delete overrides.coverUrl
        await this.db.editions.update(edition.id, { overrides })
      }
    })
  }

  private async entryEdition(entryId: string): Promise<Edition> {
    const entry = await this.db.entries.get(entryId)
    const edition = entry && (await this.db.editions.get(entry.editionId))
    if (!edition) throw new Error(`Entry ${entryId} not found`)
    return edition
  }

  private async storeCoverPhoto(edition: Edition, photo: CoverPhotoInput): Promise<void> {
    const id = newId()
    await this.db.covers.add({ id, editionId: edition.id, dataUrl: photo.dataUrl, width: photo.width, height: photo.height, createdAt: this.nowIso() })
    await this.db.editions.update(edition.id, { overrides: { ...edition.overrides, coverUrl: localCoverRef(id) } })
  }

  /** Applies fresh source data. Source values and `fetchedAt` change; overrides never do. */
  async refreshEdition(editionId: string, details: EditionDetails): Promise<void> {
    await this.db.editions.update(editionId, {
      title: details.title,
      subtitle: details.subtitle,
      isbn13: details.isbn13[0],
      isbn10: details.isbn10[0],
      publisher: details.publishers[0],
      publishYear: details.publishYear,
      ...(details.pageCount !== undefined && { pageCount: details.pageCount, 'borrowed.pageCount': false }),
      language: details.language,
      format: normalizeFormat(details.format),
      ...(details.coverUrl !== undefined && { coverUrl: details.coverUrl, 'borrowed.coverUrl': false }),
      fetchedAt: this.nowIso(),
    })
  }

  // ---------- Status ----------

  async changeStatus(
    entryId: string,
    to: Status,
    options: { startedOn?: string; endedOn?: string; stoppedAtPage?: number } = {},
  ): Promise<ChangeStatusResult> {
    return this.db.transaction('rw', [this.db.entries, this.db.editions, this.db.reads, this.db.sessions], async () => {
      const entry = await this.db.entries.get(entryId)
      if (!entry) return { ok: false, reason: 'not_found' } as const
      const edition = await this.db.editions.get(entry.editionId)
      const openRead = await this.openRead(entryId)
      const sessions = openRead ? await this.db.sessions.where('readId').equals(openRead.id).toArray() : []

      const plan = planTransition({
        from: entry.status,
        to,
        openRead,
        openReadSessions: sessions,
        pageCount: edition ? (effective(edition, 'pageCount') as number | undefined) : undefined,
        today: today(this.clock),
        ...options,
      })
      if (!plan.ok) return plan

      for (const change of plan.changes) {
        switch (change.kind) {
          case 'createRead':
            await this.db.reads.add({ id: newId(), entryId, ...change.read })
            break
          case 'closeRead':
            await this.db.reads.update(change.readId, change.patch)
            break
          case 'deleteRead':
            await this.db.reads.delete(change.readId)
            break
          case 'addFinalSession':
            await this.db.sessions.add(this.makeSession(change.readId, change.fromPage, change.toPage))
            break
        }
      }
      await this.db.entries.update(entryId, { status: plan.status, statusChangedAt: this.nowIso() })
      return { ok: true, status: plan.status } as const
    })
  }

  /** Edits a read's dates or stop page afterwards ("All dates can be edited afterwards"). */
  async updateRead(readId: string, patch: Partial<Pick<Read, 'startedOn' | 'endedOn' | 'stoppedAtPage'>>): Promise<void> {
    if (patch.startedOn && patch.endedOn && patch.endedOn < patch.startedOn) throw new Error('A read cannot end before it starts.')
    await this.db.reads.update(readId, patch)
  }

  /** Rating 0.5–5 in 0.5 steps, or undefined to clear it. */
  async setRating(entryId: string, rating: number | undefined): Promise<void> {
    if (rating !== undefined && (rating < 0.5 || rating > 5 || rating * 2 !== Math.round(rating * 2)))
      throw new Error('Ratings go from 0.5 to 5 in steps of 0.5.')
    await this.db.entries.update(entryId, { rating })
  }

  /** Marks whether I own a copy; works with any status. */
  async setOwned(entryId: string, owned: boolean): Promise<void> {
    await this.db.entries.update(entryId, { owned })
  }

  /** The entry's read in progress, if any. */
  async openRead(entryId: string): Promise<Read | undefined> {
    const reads = await this.db.reads.where('entryId').equals(entryId).toArray()
    return reads.find((r) => r.outcome === undefined)
  }

  // ---------- Reading sessions ----------

  /**
   * Quick "I'm on page N": a session from the page last reached (or 0) to N,
   * starting now. `reachedEnd` tells the UI to ask "Mark as finished?".
   */
  async logPage(entryId: string, page: number, durationMinutes?: number): Promise<LogResult> {
    return this.db.transaction('rw', [this.db.entries, this.db.editions, this.db.reads, this.db.sessions], async () => {
      const read = await this.openRead(entryId)
      if (!read) return { ok: false, error: { code: 'no_open_read', message: 'This book is not being read.' } } as const
      const sessions = await this.db.sessions.where('readId').equals(read.id).toArray()
      return this.addSessionChecked(entryId, read.id, sessions, {
        fromPage: currentPage(sessions),
        toPage: page,
        startedAt: this.nowIso(),
        durationMinutes,
      })
    })
  }

  /** Full session form, for logging past reading. */
  async addSession(
    entryId: string,
    session: { fromPage: number; toPage: number; startedAt: string; durationMinutes?: number; timeZone?: string },
  ): Promise<LogResult> {
    return this.db.transaction('rw', [this.db.entries, this.db.editions, this.db.reads, this.db.sessions], async () => {
      const read = await this.openRead(entryId)
      if (!read) return { ok: false, error: { code: 'no_open_read', message: 'This book is not being read.' } } as const
      const sessions = await this.db.sessions.where('readId').equals(read.id).toArray()
      return this.addSessionChecked(entryId, read.id, sessions, session)
    })
  }

  private async addSessionChecked(
    entryId: string,
    readId: string,
    sessions: ReadingSession[],
    s: { fromPage: number; toPage: number; startedAt: string; durationMinutes?: number; timeZone?: string },
  ): Promise<LogResult> {
    const pageCount = await this.entryPageCount(entryId)
    const error = validateSession(s, pageCount, lastSession(sessions))
    if (error) return { ok: false, error }
    const session = this.makeSession(readId, s.fromPage, s.toPage, s.startedAt, s.durationMinutes, s.timeZone)
    await this.db.sessions.add(session)
    return { ok: true, session, reachedEnd: pageCount !== undefined && session.toPage >= pageCount }
  }

  async updateSession(sessionId: string, patch: Partial<Pick<ReadingSession, 'fromPage' | 'toPage' | 'startedAt' | 'durationMinutes'>>) {
    await this.db.transaction('rw', this.db.sessions, async () => {
      const s = await this.db.sessions.get(sessionId)
      if (!s) throw new Error(`Session ${sessionId} not found`)
      const next = { ...s, ...patch }
      if (next.toPage <= next.fromPage || next.fromPage < 0) throw new Error('The end page must be after the start page.')
      await this.db.sessions.put({ ...next, pagesRead: next.toPage - next.fromPage })
    })
  }

  async deleteSession(sessionId: string) {
    await this.db.sessions.delete(sessionId)
  }

  private makeSession(
    readId: string,
    fromPage: number,
    toPage: number,
    startedAt = this.nowIso(),
    durationMinutes?: number,
    timeZone = this.clock.timeZone(),
  ): ReadingSession {
    return { id: newId(), readId, startedAt, timeZone, durationMinutes, fromPage, toPage, pagesRead: toPage - fromPage }
  }

  private async entryPageCount(entryId: string): Promise<number | undefined> {
    const entry = await this.db.entries.get(entryId)
    const edition = entry && (await this.db.editions.get(entry.editionId))
    return edition ? (effective(edition, 'pageCount') as number | undefined) : undefined
  }

  // ---------- Deleting ----------

  /** Removes an entry with its reads, sessions, notes and list items. Catalog records stay for reuse. */
  async deleteEntry(entryId: string): Promise<void> {
    await this.db.transaction('rw', [this.db.entries, this.db.reads, this.db.sessions, this.db.notes, this.db.listItems], async () => {
      const readIds = await this.db.reads.where('entryId').equals(entryId).primaryKeys()
      await this.db.sessions.where('readId').anyOf(readIds).delete()
      await this.db.reads.bulkDelete(readIds)
      await this.db.notes.where('entryId').equals(entryId).delete()
      await this.db.listItems.where('entryId').equals(entryId).delete()
      await this.db.entries.delete(entryId)
    })
  }

  /**
   * Garbage-collects works, editions and authors no library entry uses any
   * more. Series members of removed works stay as not-owned books.
   */
  async pruneOrphans(): Promise<void> {
    await this.db.transaction('rw', [this.db.entries, this.db.editions, this.db.works, this.db.authors, this.db.seriesMembers, this.db.covers], async () => {
      const usedEditions = new Set((await this.db.entries.toArray()).map((e) => e.editionId))
      const editions = await this.db.editions.toArray()
      const removedEditions = editions.filter((e) => !usedEditions.has(e.id)).map((e) => e.id)
      await this.db.editions.bulkDelete(removedEditions)
      await this.db.covers.where('editionId').anyOf(removedEditions).delete()
      const usedWorks = new Set(editions.filter((e) => usedEditions.has(e.id)).map((e) => e.workId))
      const works = await this.db.works.toArray()
      const removedWorks = works.filter((w) => !usedWorks.has(w.id)).map((w) => w.id)
      await this.db.works.bulkDelete(removedWorks)
      await this.db.seriesMembers
        .where('workId')
        .anyOf(removedWorks)
        .modify((m) => {
          delete m.workId
        })
      const usedAuthors = new Set(works.filter((w) => usedWorks.has(w.id)).flatMap((w) => w.authorIds))
      const authors = await this.db.authors.toCollection().primaryKeys()
      await this.db.authors.bulkDelete(authors.filter((id) => !usedAuthors.has(id)))
    })
  }
}
