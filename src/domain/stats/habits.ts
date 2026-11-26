import { addDays, daysBetween, weekdayOf } from './calendar'
import type { StatRead, StatsModel } from './model'
import { inPeriod, type Period } from './period'

/** Local dates with at least one session, sorted. */
export function readingDays(model: StatsModel): string[] {
  return [...new Set(model.sessions.map((s) => s.date))].sort()
}

export interface Streak {
  length: number
  from?: string
  to?: string
}

/** Consecutive reading days ending today or yesterday (a streak survives until the day is over). */
export function currentStreak(model: StatsModel, today: string): Streak {
  const days = new Set(readingDays(model))
  let end = days.has(today) ? today : addDays(today, -1)
  if (!days.has(end)) return { length: 0 }
  let start = end
  while (days.has(addDays(start, -1))) start = addDays(start, -1)
  return { length: daysBetween(start, end) + 1, from: start, to: end }
}

/** Longest run of consecutive reading days ever; the earliest one wins a tie. */
export function longestStreak(model: StatsModel): Streak {
  const days = readingDays(model)
  let best: Streak = { length: 0 }
  let runStart = days[0]
  for (let i = 0; i < days.length; i++) {
    const day = days[i]!
    if (i > 0 && daysBetween(days[i - 1]!, day) !== 1) runStart = day
    const length = daysBetween(runStart!, day) + 1
    if (length > best.length) best = { length, from: runStart, to: day }
  }
  return best
}

export interface HeatDay {
  date: string
  pages: number
  /** 0 = no reading, 1–4 = intensity steps. */
  level: 0 | 1 | 2 | 3 | 4
}

/**
 * Pages per day for the 365 days ending today, with 5 intensity steps: 0 for
 * no reading, then quarters of the biggest day in the window.
 */
export function heatmap(model: StatsModel, today: string, days = 365): HeatDay[] {
  const from = addDays(today, -(days - 1))
  let max = 0
  for (const [d, p] of model.pagesByDate) if (d >= from && d <= today && p > max) max = p
  const result: HeatDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const pages = model.pagesByDate.get(date) ?? 0
    const level = (pages <= 0 ? 0 : Math.max(1, Math.ceil((pages / max) * 4))) as HeatDay['level']
    result.push({ date, pages, level })
  }
  return result
}

/** Pages by weekday (0 = Monday) and by hour of the session's start, in the period. */
export function pagesByWeekdayAndHour(model: StatsModel, period: Period): { weekday: number[]; hour: number[] } {
  const weekday = Array<number>(7).fill(0)
  const hour = Array<number>(24).fill(0)
  for (const s of model.sessions) {
    if (!inPeriod(s.date, period)) continue
    weekday[weekdayOf(s.date)]! += s.pagesRead
    hour[s.hour]! += s.pagesRead
  }
  return { weekday, hour }
}

/** Pages per hour over sessions with a duration; undefined when there are none. */
export function readingSpeed(sessions: readonly { pagesRead: number; durationMinutes?: number }[]): number | undefined {
  let pages = 0
  let minutes = 0
  for (const s of sessions) {
    if (!s.durationMinutes) continue
    pages += s.pagesRead
    minutes += s.durationMinutes
  }
  return minutes ? (pages / minutes) * 60 : undefined
}

export function readingSpeedInPeriod(model: StatsModel, period: Period): { overall?: number; perBook: { read: StatRead; pagesPerHour: number }[] } {
  const sessions = model.sessions.filter((s) => inPeriod(s.date, period))
  const byRead = new Map<StatRead, typeof sessions>()
  for (const s of sessions) byRead.set(s.read, [...(byRead.get(s.read) ?? []), s])
  const perBook = [...byRead].flatMap(([read, list]) => {
    const pagesPerHour = readingSpeed(list)
    return pagesPerHour === undefined ? [] : [{ read, pagesPerHour }]
  })
  return { overall: readingSpeed(sessions), perBook: perBook.sort((a, b) => b.pagesPerHour - a.pagesPerHour) }
}

/**
 * Finish date forecast for an open read: remaining pages ÷ average pages per
 * day over the read's last 14 days (today included). Undefined when nothing
 * was read in that window or the page count is unknown.
 */
export function finishForecast(read: StatRead, today: string): { date: string; pagesPerDay: number; remaining: number } | undefined {
  const pageCount = read.book.pageCount
  if (!pageCount || read.outcome) return undefined
  const page = read.sessions.at(-1)?.toPage ?? 0
  const remaining = pageCount - page
  if (remaining <= 0) return { date: today, pagesPerDay: 0, remaining: 0 }
  const from = addDays(today, -13)
  const recent = read.sessions.filter((s) => s.date >= from && s.date <= today).reduce((sum, s) => sum + s.pagesRead, 0)
  if (recent === 0) return undefined
  const pagesPerDay = recent / 14
  return { date: addDays(today, Math.ceil(remaining / pagesPerDay)), pagesPerDay, remaining }
}

/** Days from start to finish (endedOn − startedOn + 1) for finished reads in the period, fastest first. */
export function timeToFinish(model: StatsModel, period: Period): { read: StatRead; days: number }[] {
  return model.reads
    .filter((r) => r.outcome === 'finished' && !r.startUnknown && inPeriod(r.endedOn, period))
    .map((read) => ({ read, days: daysBetween(read.startedOn, read.endedOn!) + 1 }))
    .sort((a, b) => a.days - b.days || a.read.book.title.localeCompare(b.read.book.title))
}
