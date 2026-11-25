import { boundedPeriod, inPeriod, type Period } from './period'
import { daysBetween, isLeapYear, monthOf, monthsBetween, yearOf } from './calendar'
import type { StatRead, StatsModel } from './model'

/** Finished reads whose end date falls in the period (rereads count again). */
export function finishedReads(model: StatsModel, period: Period): StatRead[] {
  return model.reads.filter((r) => r.outcome === 'finished' && inPeriod(r.endedOn, period))
}

/** Reads the attribute stats look at: finished ones, plus DNF ones when asked. */
export function attributeReads(model: StatsModel, period: Period, includeDnf = false): StatRead[] {
  return model.reads.filter((r) => (r.outcome === 'finished' || (includeDnf && r.outcome === 'dnf')) && inPeriod(r.endedOn, period))
}

export function booksRead(model: StatsModel, period: Period): { total: number; unique: number } {
  const reads = finishedReads(model, period)
  return { total: reads.length, unique: new Set(reads.map((r) => r.book.workId)).size }
}

export function pagesRead(model: StatsModel, period: Period): number {
  let sum = 0
  for (const [date, pages] of model.pagesByDate) if (inPeriod(date, period)) sum += pages
  return sum
}

/** First and last date with any reading data, for open-ended periods. */
export function dataRange(model: StatsModel): { first?: string; last?: string } {
  const dates = [...model.pagesByDate.keys(), ...model.reads.map((r) => r.endedOn).filter((d): d is string => Boolean(d))].sort()
  return { first: dates[0], last: dates.at(-1) }
}

export interface MonthPoint {
  month: string
  books: number
  pages: number
}

/** Books and pages per month across the period (bounded by data and today). */
export function perMonth(model: StatsModel, period: Period, today: string): MonthPoint[] {
  const range = boundedPeriod(period, today, dataRange(model).first)
  if (!range) return []
  const points = new Map(monthsBetween(range.from, range.to).map((m) => [m, { month: m, books: 0, pages: 0 }]))
  for (const r of finishedReads(model, range)) points.get(monthOf(r.endedOn!))!.books += 1
  for (const [date, pages] of model.pagesByDate) if (inPeriod(date, range)) points.get(monthOf(date))!.pages += pages
  return [...points.values()]
}

export interface GoalPace {
  target: number
  actual: number
  expected: number
  /** actual − expected, rounded to whole units: positive is ahead. */
  difference: number
  /** 0–1 share of the year elapsed. */
  yearElapsed: number
}

/** expected = target × (days elapsed ÷ days in year); today counts as elapsed. */
export function goalPace(target: number, actual: number, year: number, today: string): GoalPace {
  const daysInYear = isLeapYear(year) ? 366 : 365
  const elapsed = yearOf(today) < year ? 0 : yearOf(today) > year ? daysInYear : daysBetween(`${year}-01-01`, today) + 1
  const expected = (target * elapsed) / daysInYear
  return { target, actual, expected, difference: Math.round(actual - expected), yearElapsed: elapsed / daysInYear }
}

/** Pages ÷ days in the period, and pages ÷ reading days only. */
export function pagesPerDay(model: StatsModel, period: Period, today: string): { perDay: number; perReadingDay: number } {
  const range = boundedPeriod(period, today, dataRange(model).first)
  if (!range) return { perDay: 0, perReadingDay: 0 }
  const pages = pagesRead(model, range)
  const readingDays = new Set(model.sessions.filter((s) => inPeriod(s.date, range)).map((s) => s.date)).size
  return { perDay: pages / (daysBetween(range.from, range.to) + 1), perReadingDay: readingDays ? pages / readingDays : 0 }
}

/** Reads started, finished and abandoned (DNF) in the period. */
export function startedVsFinished(model: StatsModel, period: Period): { started: number; finished: number; dnf: number } {
  return {
    started: model.reads.filter((r) => inPeriod(r.startedOn, period)).length,
    finished: model.reads.filter((r) => r.outcome === 'finished' && inPeriod(r.endedOn, period)).length,
    dnf: model.reads.filter((r) => r.outcome === 'dnf' && inPeriod(r.endedOn, period)).length,
  }
}
