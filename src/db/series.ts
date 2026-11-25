/**
 * Series repository (design doc, Series): creating and editing series, and
 * placing works in them. Membership is per work, so every edition of a book
 * counts toward its series.
 */
import { compareMembers, seriesKey } from '@/domain/series'
import type { Series, SeriesMember, SeriesOrigin, Work } from '@/domain/types'

import { newId, systemClock, type Clock } from './clock'
import type { ReadhoundDB } from './schema'

export interface MemberInput {
  position?: number
  title?: string
  authorName?: string
  olWorkId?: string
  wikidataId?: string
  origin?: SeriesOrigin
}

export class SeriesRepository {
  private readonly db: ReadhoundDB
  private readonly clock: Clock

  constructor(database: ReadhoundDB, clock: Clock = systemClock) {
    this.db = database
    this.clock = clock
  }

  private nowIso() {
    return this.clock.now().toISOString()
  }

  // ---------- Series ----------

  async createSeries(input: { name: string; totalBooks?: number; wikidataId?: string; origin?: SeriesOrigin }): Promise<string> {
    const name = input.name.trim()
    if (!name) throw new Error('A series needs a name.')
    checkTotal(input.totalBooks)
    const series: Series = {
      id: newId(),
      name,
      totalBooks: input.totalBooks,
      wikidataId: input.wikidataId,
      origin: input.origin ?? 'manual',
      createdAt: this.nowIso(),
    }
    await this.db.series.add(series)
    return series.id
  }

  /**
   * The series with this Wikidata ID or (folded) name, created if missing.
   * Detection uses it so the same series found twice is stored once.
   */
  async findOrCreateSeries(input: { name: string; totalBooks?: number; wikidataId?: string; origin: SeriesOrigin }): Promise<string> {
    return this.db.transaction('rw', this.db.series, async () => {
      const all = await this.db.series.toArray()
      const byWikidata = input.wikidataId ? all.find((s) => s.wikidataId === input.wikidataId) : undefined
      const key = seriesKey(input.name)
      const existing = byWikidata ?? all.find((s) => seriesKey(s.name) === key)
      if (existing) {
        // Fill gaps only; the user's name and total are kept.
        const patch: Partial<Series> = {}
        if (input.wikidataId && !existing.wikidataId) patch.wikidataId = input.wikidataId
        if (input.totalBooks && existing.totalBooks === undefined && existing.origin !== 'manual') patch.totalBooks = input.totalBooks
        if (Object.keys(patch).length) await this.db.series.update(existing.id, patch)
        return existing.id
      }
      return this.createSeries(input)
    })
  }

  /** Edits made here mark the series as the user's, so detection never changes it again. */
  async updateSeries(seriesId: string, patch: { name?: string; totalBooks?: number | null }): Promise<void> {
    const name = patch.name?.trim()
    if (patch.name !== undefined && !name) throw new Error('A series needs a name.')
    if (patch.totalBooks !== null) checkTotal(patch.totalBooks)
    await this.db.series
      .where('id')
      .equals(seriesId)
      .modify((s) => {
        if (name) s.name = name
        if (patch.totalBooks === null) delete s.totalBooks
        else if (patch.totalBooks !== undefined) s.totalBooks = patch.totalBooks
        s.origin = 'manual'
      })
  }

  /** Deletes the series and its members. The books stay in the library. */
  async deleteSeries(seriesId: string): Promise<void> {
    await this.db.transaction('rw', [this.db.series, this.db.seriesMembers], async () => {
      await this.db.seriesMembers.where('seriesId').equals(seriesId).delete()
      await this.db.series.delete(seriesId)
    })
  }

  // ---------- Members ----------

  /**
   * Puts a work in a series at a position, or moves it if it is already
   * there. A matching not-yet-owned member (same catalog work or title) is
   * taken over, so the gap fills in instead of the book showing twice.
   */
  async setWorkSeries(workId: string, seriesId: string, input: MemberInput = {}): Promise<string> {
    checkPosition(input.position)
    return this.db.transaction('rw', [this.db.works, this.db.series, this.db.seriesMembers], async () => {
      const work = await this.db.works.get(workId)
      if (!work) throw new Error(`Work ${workId} not found`)
      if (!(await this.db.series.get(seriesId))) throw new Error(`Series ${seriesId} not found`)
      const members = await this.db.seriesMembers.where('seriesId').equals(seriesId).toArray()
      const olWorkId = work.sourceRef?.source === 'openlibrary' ? work.sourceRef.id : input.olWorkId
      const current =
        members.find((m) => m.workId === workId) ??
        members.find((m) => !m.workId && ((olWorkId && m.olWorkId === olWorkId) || (input.wikidataId && m.wikidataId === input.wikidataId))) ??
        members.find((m) => !m.workId && seriesKey(m.title) === seriesKey(work.title) && (input.position === undefined || m.position === input.position))
      if (current) {
        await this.db.seriesMembers.update(current.id, {
          workId,
          title: work.title,
          ...('position' in input && { position: input.position }),
          ...(olWorkId && { olWorkId }),
          ...(input.wikidataId && { wikidataId: input.wikidataId }),
          ...(input.origin === 'manual' && { origin: 'manual' as const }),
        })
        return current.id
      }
      const member: SeriesMember = {
        id: newId(),
        seriesId,
        workId,
        title: work.title,
        position: input.position,
        olWorkId,
        wikidataId: input.wikidataId,
        origin: input.origin ?? 'manual',
        addedAt: this.nowIso(),
      }
      await this.db.seriesMembers.add(member)
      return member.id
    })
  }

  /** A book of the series the user doesn't own (yet), so the series shows its gaps. */
  async addMissingMember(seriesId: string, input: MemberInput & { title: string }): Promise<string> {
    const title = input.title.trim()
    if (!title) throw new Error('A book needs a title.')
    checkPosition(input.position)
    const member: SeriesMember = {
      id: newId(),
      seriesId,
      title,
      authorName: input.authorName?.trim() || undefined,
      position: input.position,
      olWorkId: input.olWorkId,
      wikidataId: input.wikidataId,
      origin: input.origin ?? 'manual',
      addedAt: this.nowIso(),
    }
    await this.db.seriesMembers.add(member)
    return member.id
  }

  async updateMember(memberId: string, patch: { position?: number | null; title?: string }): Promise<void> {
    if (patch.position !== null) checkPosition(patch.position)
    const title = patch.title?.trim()
    if (patch.title !== undefined && !title) throw new Error('A book needs a title.')
    await this.db.seriesMembers
      .where('id')
      .equals(memberId)
      .modify((m) => {
        if (patch.position === null) delete m.position
        else if (patch.position !== undefined) m.position = patch.position
        if (title) m.title = title
        m.origin = 'manual'
      })
  }

  async removeMember(memberId: string): Promise<void> {
    await this.db.seriesMembers.delete(memberId)
  }

  /** Members of a series in series order. */
  async members(seriesId: string): Promise<SeriesMember[]> {
    const members = await this.db.seriesMembers.where('seriesId').equals(seriesId).toArray()
    return members.sort(compareMembers)
  }
}

/**
 * Links not-yet-owned members to a work that was just added, by its Open
 * Library ID. Runs inside the library repository's add transaction.
 */
export async function linkWorkToMembers(db: ReadhoundDB, work: Pick<Work, 'id' | 'sourceRef' | 'title'>): Promise<void> {
  if (work.sourceRef?.source !== 'openlibrary') return
  const olWorkId = work.sourceRef.id
  await db.seriesMembers
    .where('olWorkId')
    .equals(olWorkId)
    .filter((m) => !m.workId)
    .modify({ workId: work.id })
}

function checkPosition(position: number | undefined) {
  if (position !== undefined && (!Number.isFinite(position) || position < 0)) throw new Error('A position is a number of 0 or more.')
}

function checkTotal(total: number | undefined) {
  if (total !== undefined && (!Number.isInteger(total) || total < 1)) throw new Error('The number of books is a whole number of 1 or more.')
}
