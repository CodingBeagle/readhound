import { daysBetween } from './calendar'
import { longestStreak } from './habits'
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

export interface Milestone {
  id: string
  kind: 'pages' | 'books' | 'streak' | 'category'
  threshold: number
  label: string
  /** Date it was reached; undefined while still locked. */
  unlockedOn?: string
  /** Progress towards it, 0–1. */
  progress: number
}

const PAGE_MILESTONES = [1000, 5000, 10000, 25000, 50000]
const BOOK_MILESTONES = [1, 10, 25, 50, 100]
const STREAK_MILESTONES = [7, 30, 100]
const CATEGORY_MILESTONE = 5

/**
 * Rule-based badges. The unlock date is worked out from the data (the day the
 * running total crossed the threshold), so nothing needs storing and an
 * import or a deleted session keeps them correct.
 */
export function milestones(model: StatsModel): Milestone[] {
  const result: Milestone[] = []

  let pages = 0
  const pageDates = [...model.pagesByDate].sort(([a], [b]) => a.localeCompare(b))
  const pageUnlocks = new Map<number, string>()
  for (const [date, p] of pageDates) {
    pages += p
    for (const t of PAGE_MILESTONES) if (pages >= t && !pageUnlocks.has(t)) pageUnlocks.set(t, date)
  }
  for (const t of PAGE_MILESTONES)
    result.push({ id: `pages-${t}`, kind: 'pages', threshold: t, label: `${t.toLocaleString('en')} pages`, unlockedOn: pageUnlocks.get(t), progress: Math.min(1, pages / t) })

  const finished = model.reads.filter((r) => r.outcome === 'finished' && r.endedOn).sort((a, b) => a.endedOn!.localeCompare(b.endedOn!))
  for (const t of BOOK_MILESTONES)
    result.push({
      id: `books-${t}`,
      kind: 'books',
      threshold: t,
      label: t === 1 ? 'First book' : `${t} books`,
      unlockedOn: finished[t - 1]?.endedOn,
      progress: Math.min(1, finished.length / t),
    })

  // A streak milestone unlocks on the day the first long-enough run reached it.
  const days = [...new Set(model.sessions.map((s) => s.date))].sort()
  const best = longestStreak(model).length
  for (const t of STREAK_MILESTONES) {
    let unlockedOn: string | undefined
    let run = 0
    for (let i = 0; i < days.length && !unlockedOn; i++) {
      run = i > 0 && daysBetween(days[i - 1]!, days[i]!) === 1 ? run + 1 : 1
      if (run >= t) unlockedOn = days[i]
    }
    result.push({ id: `streak-${t}`, kind: 'streak', threshold: t, label: `${t}-day streak`, unlockedOn, progress: Math.min(1, best / t) })
  }

  for (const category of model.categories) {
    const reads = finished.filter((r) => r.book.entry.categoryIds.includes(category.id))
    if (reads.length === 0) continue
    result.push({
      id: `category-${category.id}`,
      kind: 'category',
      threshold: CATEGORY_MILESTONE,
      label: `${CATEGORY_MILESTONE} × ${category.name}`,
      unlockedOn: reads[CATEGORY_MILESTONE - 1]?.endedOn,
      progress: Math.min(1, reads.length / CATEGORY_MILESTONE),
    })
  }
  return result
}
