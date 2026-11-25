import { daysBetween } from './calendar'
import { topAuthors } from './content'
import type { StatRead, StatsModel } from './model'
import type { Period } from './period'
import { booksRead, finishedReads, pagesRead } from './totals'

export interface YearBook {
  entryId: string
  title: string
  authors: string[]
  coverUrl?: string
  pages?: number
  rating?: number
  days: number
  endedOn: string
}

export interface YearInReview {
  year: number
  books: number
  uniqueBooks: number
  pages: number
  topAuthors: { name: string; count: number }[]
  topGenres: { name: string; count: number }[]
  longest?: YearBook
  shortest?: YearBook
  fastest?: YearBook
  highestRated?: YearBook
  /** Longest run of reading days inside the year. */
  streak: { length: number; from?: string; to?: string }
  first?: YearBook
  last?: YearBook
  readingDays: number
}

const yearBook = (r: StatRead): YearBook => ({
  entryId: r.book.entry.id,
  title: r.book.title,
  authors: r.book.authors.map((a) => a.name),
  coverUrl: r.book.edition.coverUrl,
  pages: r.book.pageCount,
  rating: r.book.entry.rating,
  days: daysBetween(r.startedOn, r.endedOn!) + 1,
  endedOn: r.endedOn!,
})

/** First item by `better`; ties go to the book finished first, so the result is stable. */
function best<T extends YearBook>(items: T[], better: (a: T, b: T) => number): T | undefined {
  return [...items].sort((a, b) => better(a, b) || a.endedOn.localeCompare(b.endedOn))[0]
}

/**
 * The year's summary from the design doc: books, pages, top 5 authors and
 * genres, longest and shortest book, fastest read, highest rated, streak
 * record, first and last book. Undefined fields mean the year has nothing for them.
 */
export function yearInReview(model: StatsModel, year: number): YearInReview {
  const period: Period = { from: `${year}-01-01`, to: `${year}-12-31` }
  const reads = finishedReads(model, period)
  const books = reads.map(yearBook)
  const withPages = books.filter((b) => b.pages)
  const rated = books.filter((b) => b.rating !== undefined)

  const genreCounts = new Map<string, number>()
  for (const r of reads) for (const g of r.book.genres) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1)

  const days = [...new Set(model.sessions.filter((s) => s.date >= period.from! && s.date <= period.to!).map((s) => s.date))].sort()
  let streak: YearInReview['streak'] = { length: 0 }
  let runStart = days[0]
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && daysBetween(days[i - 1]!, days[i]!) !== 1) runStart = days[i]
    const length = daysBetween(runStart!, days[i]!) + 1
    if (length > streak.length) streak = { length, from: runStart, to: days[i] }
  }

  const { total, unique } = booksRead(model, period)
  return {
    year,
    books: total,
    uniqueBooks: unique,
    pages: pagesRead(model, period),
    topAuthors: topAuthors(model, period)
      .slice(0, 5)
      .map((a) => ({ name: a.name, count: a.count })),
    topGenres: [...genreCounts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5),
    longest: best(withPages, (a, b) => b.pages! - a.pages!),
    shortest: best(withPages, (a, b) => a.pages! - b.pages!),
    fastest: best(books, (a, b) => a.days - b.days),
    highestRated: best(rated, (a, b) => b.rating! - a.rating!),
    streak,
    first: best(books, () => 0),
    last: [...books].sort((a, b) => b.endedOn.localeCompare(a.endedOn))[0],
    readingDays: days.length,
  }
}

/** Years with at least one finished read, newest first. */
export function reviewYears(model: StatsModel): number[] {
  return [...new Set(model.reads.filter((r) => r.outcome === 'finished' && r.endedOn).map((r) => Number(r.endedOn!.slice(0, 4))))].sort((a, b) => b - a)
}
