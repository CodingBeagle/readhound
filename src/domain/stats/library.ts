import { daysBetween } from './calendar'
import type { StatsModel } from './model'
import { inPeriod, type Period } from './period'

/** The to-read pile: size, average and longest wait so far, and the five oldest. */
export function toReadPile(model: StatsModel, today: string) {
  const pile = model.books
    .filter((b) => b.entry.status === 'to_read')
    .map((book) => ({ book, waitingDays: Math.max(0, daysBetween(book.entry.addedAt.slice(0, 10), today)) }))
    .sort((a, b) => b.waitingDays - a.waitingDays)
  const total = pile.reduce((sum, p) => sum + p.waitingDays, 0)
  return { count: pile.length, averageWait: pile.length ? total / pile.length : 0, longestWait: pile[0]?.waitingDays ?? 0, oldest: pile.slice(0, 5) }
}

/**
 * My own books: how many, by format, and the shelf of ones I own but haven't
 * read (on the to-read pile and never finished), with their pages and the
 * longest-waiting five.
 */
export function ownedShelf(model: StatsModel, today: string) {
  const finished = new Set(model.reads.filter((r) => r.outcome === 'finished').map((r) => r.entryId))
  const owned = model.books.filter((b) => b.entry.owned)
  const formats = new Map<string, number>()
  for (const b of owned) formats.set(b.edition.format ?? 'unknown', (formats.get(b.edition.format ?? 'unknown') ?? 0) + 1)
  const unread = owned
    .filter((b) => b.entry.status === 'to_read' && !finished.has(b.entry.id))
    .map((book) => ({ book, waitingDays: Math.max(0, daysBetween(book.entry.addedAt.slice(0, 10), today)) }))
    .sort((a, b) => b.waitingDays - a.waitingDays)
  return {
    owned: owned.length,
    unread: unread.length,
    /** Share of owned books not read yet, 0–1. */
    unreadShare: owned.length ? unread.length / owned.length : 0,
    unreadPages: unread.reduce((sum, u) => sum + (u.book.pageCount ?? 0), 0),
    byFormat: [...formats].map(([format, count]) => ({ format, count })).sort((a, b) => b.count - a.count),
    oldestUnread: unread.slice(0, 5),
  }
}

export const WAIT_BUCKETS = ['Under a week', '1–4 weeks', '1–6 months', '6–12 months', 'Over a year'] as const

/**
 * Days between adding a book and first starting it, for books that waited on
 * the to-read pile (first reads that began after the day the book was added).
 * Books added as "currently reading" or "finished" are left out. Grouped by
 * the start date in the period.
 */
export function waitBeforeStarting(model: StatsModel, period: Period) {
  const firstReads = new Map<string, (typeof model.reads)[number]>()
  for (const r of model.reads) {
    const current = firstReads.get(r.entryId)
    if (!current || r.startedOn < current.startedOn) firstReads.set(r.entryId, r)
  }
  const waits = [...firstReads.values()]
    .filter((r) => inPeriod(r.startedOn, period))
    .map((r) => daysBetween(r.book.entry.addedAt.slice(0, 10), r.startedOn))
    .filter((d) => d > 0)
  const bucket = (d: number) => (d < 7 ? 0 : d < 30 ? 1 : d < 182 ? 2 : d < 365 ? 3 : 4)
  const counts = Array<number>(WAIT_BUCKETS.length).fill(0)
  for (const d of waits) counts[bucket(d)]! += 1
  return {
    average: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : undefined,
    count: waits.length,
    buckets: WAIT_BUCKETS.map((label, i) => ({ label, count: counts[i]! })),
  }
}

/** For DNF reads in the period: how far in the reader stopped, in 10% buckets (0 = 0–9%, … 9 = 90–100%). */
export function whereIStop(model: StatsModel, period: Period) {
  const buckets = Array<number>(10).fill(0)
  let unknown = 0
  for (const r of model.reads) {
    if (r.outcome !== 'dnf' || !inPeriod(r.endedOn, period)) continue
    const pages = r.book.pageCount
    const stopped = r.stoppedAtPage ?? r.sessions.at(-1)?.toPage
    if (!pages || stopped === undefined) {
      unknown += 1
      continue
    }
    buckets[Math.min(9, Math.floor((stopped / pages) * 10))]! += 1
  }
  return { buckets: buckets.map((count, i) => ({ from: i * 10, count })), unknown }
}

export interface Landmark {
  name: string
  metres: number
}

/** Heights to compare the stack with, smallest first. */
export const LANDMARKS: Landmark[] = [
  { name: 'Little Mermaid statue', metres: 1.25 },
  { name: 'giraffe', metres: 5.5 },
  { name: 'Round Tower', metres: 34.8 },
  { name: 'Statue of Liberty', metres: 93 },
  { name: 'Eiffel Tower', metres: 330 },
]

/** Pages stacked as paper: pages × thickness (0.1 mm by default), with the tallest landmark it beats. */
export function stackHeight(pages: number, mmPerPage = 0.1) {
  const metres = (pages * mmPerPage) / 1000
  const landmark = [...LANDMARKS].reverse().find((l) => metres >= l.metres) ?? LANDMARKS[0]!
  return { metres, landmark, times: metres / landmark.metres }
}
