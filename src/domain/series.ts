/**
 * Series tracking (design doc, Series): pure helpers to join series with the
 * library, work out progress and the next book to read, and parse the free
 * text series labels catalogs return ("Discworld, #3", "Afdeling Q ; 2").
 */
import type { BookView } from './bookView'
import type { Series, SeriesMember, Status } from './types'

/** What the user has done with one book of a series. `missing` means not in the library. */
export type MemberState = Status | 'missing'

export interface SeriesMemberView {
  member: SeriesMember
  /** The library copy of this work, if any. With several editions, the most advanced one. */
  book?: BookView
  state: MemberState
  /** Title to show: the user's edition title when owned, else the member's own. */
  title: string
}

export interface SeriesView {
  series: Series
  /** In series order; members without a position last, by title. */
  members: SeriesMemberView[]
  /** Books in the series: the known total, or the number of members if larger or unknown. */
  total: number
  finished: number
  owned: number
  /** Every book of the series finished (needs at least two books). */
  complete: boolean
  /** The next book to read, once at least one is finished and the series isn't done. */
  next?: SeriesMemberView
  /** Latest end date of a finished read in the series. */
  lastFinishedOn?: string
}

/** One series a book belongs to, as shown on the book. */
export interface BookSeries {
  series: Series
  member: SeriesMember
  position?: number
}

const STATE_RANK: Record<MemberState, number> = { finished: 4, reading: 3, dnf: 2, to_read: 1, missing: 0 }

const byTitle = (a: string, b: string) => a.localeCompare(b, 'da', { sensitivity: 'base' })

/** Series order: by position, then unnumbered members by title. */
export function compareMembers(a: Pick<SeriesMember, 'position' | 'title'>, b: Pick<SeriesMember, 'position' | 'title'>): number {
  if (a.position !== undefined && b.position !== undefined && a.position !== b.position) return a.position - b.position
  if (a.position !== undefined && b.position === undefined) return -1
  if (a.position === undefined && b.position !== undefined) return 1
  return byTitle(a.title, b.title)
}

/** A finished read counts the book as finished even if the status later changed (a reread in progress). */
function stateOf(book: BookView): MemberState {
  if (book.lastFinishedOn) return 'finished'
  return book.entry.status
}

export function buildSeriesViews(series: readonly Series[], members: readonly SeriesMember[], books: readonly BookView[]): SeriesView[] {
  const booksByWork = new Map<string, BookView[]>()
  for (const b of books) {
    const workId = b.edition.workId
    booksByWork.set(workId, [...(booksByWork.get(workId) ?? []), b])
  }
  const membersBySeries = new Map<string, SeriesMember[]>()
  for (const m of members) membersBySeries.set(m.seriesId, [...(membersBySeries.get(m.seriesId) ?? []), m])

  return series
    .map((s) => {
      const views = (membersBySeries.get(s.id) ?? [])
        .map((member): SeriesMemberView => {
          const copies = member.workId ? (booksByWork.get(member.workId) ?? []) : []
          const book = [...copies].sort((a, b) => STATE_RANK[stateOf(b)] - STATE_RANK[stateOf(a)])[0]
          return { member, book, state: book ? stateOf(book) : 'missing', title: book?.edition.title ?? member.title }
        })
        .sort((a, b) => compareMembers({ ...a.member, title: a.title }, { ...b.member, title: b.title }))
      const finished = views.filter((v) => v.state === 'finished')
      const total = Math.max(s.totalBooks ?? 0, views.length)
      const complete = total >= 2 && finished.length >= total
      const lastFinishedOn = finished
        .map((v) => v.book?.lastFinishedOn)
        .filter((d): d is string => !!d)
        .sort()
        .at(-1)
      return {
        series: s,
        members: views,
        total,
        finished: finished.length,
        owned: views.filter((v) => v.state !== 'missing').length,
        complete,
        next: complete ? undefined : nextMember(views),
        lastFinishedOn,
      }
    })
    .sort((a, b) => byTitle(a.series.name, b.series.name))
}

/**
 * The next book after the furthest one finished: the first later member not
 * finished. Nothing until a book in the series is finished, and nothing when
 * that next book is already being read.
 */
function nextMember(views: readonly SeriesMemberView[]): SeriesMemberView | undefined {
  const lastFinished = views.findLastIndex((v) => v.state === 'finished')
  if (lastFinished === -1) return undefined
  const next = views.slice(lastFinished + 1).find((v) => v.state !== 'finished') ?? views.find((v) => v.state !== 'finished')
  return next && next.state !== 'reading' ? next : undefined
}

/**
 * "Next in series" suggestions, most recently continued series first. A
 * hook for recommendations too: prefer these works over unrelated books.
 */
export function nextInSeries(views: readonly SeriesView[], options: { since?: string; limit?: number } = {}): (SeriesView & { next: SeriesMemberView })[] {
  return views
    .filter((v): v is SeriesView & { next: SeriesMemberView } => v.next !== undefined && (!options.since || (v.lastFinishedOn ?? '') >= options.since))
    .sort((a, b) => (b.lastFinishedOn ?? '').localeCompare(a.lastFinishedOn ?? ''))
    .slice(0, options.limit ?? Infinity)
}

/** Work IDs (in the library) or catalog IDs (not yet owned) recommendations should rank first. */
export function preferredNextWorks(views: readonly SeriesView[]): { workIds: Set<string>; olWorkIds: Set<string> } {
  const workIds = new Set<string>()
  const olWorkIds = new Set<string>()
  for (const v of nextInSeries(views)) {
    if (v.next.member.workId) workIds.add(v.next.member.workId)
    if (v.next.member.olWorkId) olWorkIds.add(v.next.member.olWorkId)
  }
  return { workIds, olWorkIds }
}

/** The series each work belongs to, for building book views. */
export function seriesByWork(series: readonly Series[], members: readonly SeriesMember[]): Map<string, BookSeries[]> {
  const seriesById = new Map(series.map((s) => [s.id, s]))
  const out = new Map<string, BookSeries[]>()
  for (const member of members) {
    const s = member.workId ? seriesById.get(member.seriesId) : undefined
    if (!s || !member.workId) continue
    out.set(member.workId, [...(out.get(member.workId) ?? []), { series: s, member, position: member.position }])
  }
  for (const list of out.values()) list.sort((a, b) => byTitle(a.series.name, b.series.name))
  return out
}

/** "3", "3.5"; positions are stored as numbers. */
export function formatPosition(position: number | undefined): string | undefined {
  return position === undefined ? undefined : String(position)
}

/** Parses user input such as "3", "3.5" or "3,5". Empty means no position. Returns null when invalid. */
export function parsePosition(input: string): number | undefined | null {
  const text = input.trim().replace(',', '.')
  if (!text) return undefined
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`

/**
 * Splits a catalog series label into a name and position. Handles the shapes
 * Open Library uses, e.g. "Harry Potter, #1", "A Song of Ice and Fire #1",
 * "Discworld -- 3", "Millennium ; 1", "(Afdeling Q ; bd. 2)", "Earthsea, book 2"
 * and "Wheel of Time vol. 4". Labels without a number keep the whole name.
 */
export function parseSeriesLabel(raw: string): { name: string; position?: number } | null {
  let text = raw.trim().replace(/^\((.*)\)$/, '$1').trim()
  if (!text) return null
  const patterns = [
    new RegExp(String.raw`^(.*?)[\s,;:\-–—]*#\s*${NUMBER}\s*$`, 'i'),
    new RegExp(String.raw`^(.*?)[\s,;:\-–—]*\b(?:book|bk\.?|vol\.?|volume|no\.?|nr\.?|number|bd\.?|bind|del|part|tome)\s*${NUMBER}\s*$`, 'i'),
    new RegExp(String.raw`^(.*?)\s*(?:--|;|,|:|–|—)\s*${NUMBER}\s*$`),
    new RegExp(String.raw`^(.*?\D)\s+${NUMBER}\s*$`),
  ]
  for (const pattern of patterns) {
    const m = text.match(pattern)
    const name = m?.[1]?.trim().replace(/[\s,;:\-–—]+$/, '')
    if (m && name) {
      const position = Number(m[2]!.replace(',', '.'))
      // Years are not positions: "Penguin Classics 2003".
      if (position >= 1000) break
      return { name, position }
    }
  }
  text = text.replace(/[\s,;:\-–—]+$/, '')
  return text ? { name: text } : null
}

/** Folds a series name for matching ("The Expanse" ≈ "expanse"). */
export function seriesKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/^(the|a|an|den|det|de)\s+/, '')
    .replace(/\b(series|serien|trilogy|trilogien|saga|sagaen|chronicles?|cycle)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
