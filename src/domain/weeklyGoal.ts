/**
 * Weekly pages goal (design doc, Weekly pages goal): a target of pages per
 * week, Monday to Sunday, counted from the same pages-per-date as every other
 * stat. Pure, so the rules can be tested against a fixed model and date.
 */
import { addDays, daysBetween, weekdayOf } from './stats/calendar'
import type { StatsModel } from './stats/model'

/** Settings key holding the weekly target as a whole number of pages. */
export const SETTING_WEEKLY_PAGES_GOAL = 'weeklyPagesGoal'
export const WEEKLY_GOAL_MAX = 10_000
/** One-tap targets offered when no goal is set yet. */
export const WEEKLY_GOAL_PRESETS = [100, 200, 350, 500] as const

/**
 * How far along the week is, in bands the progress bar and the buddy react to:
 * none (0 pages), started (< 25 %), going (< 50 %), halfway (< 75 %),
 * close (< 90 %), almost (< 100 %), done (≥ 100 %), beyond (≥ 150 %).
 */
export const WEEKLY_BANDS = ['none', 'started', 'going', 'halfway', 'close', 'almost', 'done', 'beyond'] as const
export type WeeklyBand = (typeof WEEKLY_BANDS)[number]

export interface WeekDay {
  date: string
  pages: number
}

export interface WeeklyProgress {
  target: number
  pages: number
  /** pages / target, not capped. */
  share: number
  remaining: number
  band: WeeklyBand
  /** 0 (nothing yet) to 5 (goal reached): how intense the bar looks. */
  intensity: 0 | 1 | 2 | 3 | 4 | 5
  /** Monday of this week. */
  from: string
  /** Sunday of this week. */
  to: string
  /** Days left in the week, today included (Monday 7 … Sunday 1). */
  daysLeft: number
  /** Pages a day still needed to reach the goal, rounded up; 0 when reached. */
  perDayNeeded: number
  /** The date the goal was reached, when it was. */
  reachedOn?: string
  days: WeekDay[]
}

/** The Monday that starts the week holding `date`. */
export const weekStartOf = (date: string) => addDays(date, -weekdayOf(date))

/** Reads a stored setting value as a valid target, or undefined. */
export function parseWeeklyGoal(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return undefined
  const whole = Math.round(n)
  return whole > 0 ? Math.min(whole, WEEKLY_GOAL_MAX) : undefined
}

export function bandFor(share: number, pages: number): WeeklyBand {
  if (pages <= 0) return 'none'
  if (share >= 1.5) return 'beyond'
  if (share >= 1) return 'done'
  if (share >= 0.9) return 'almost'
  if (share >= 0.75) return 'close'
  if (share >= 0.5) return 'halfway'
  if (share >= 0.25) return 'going'
  return 'started'
}

const INTENSITY: Record<WeeklyBand, WeeklyProgress['intensity']> = {
  none: 0,
  started: 1,
  going: 2,
  halfway: 3,
  close: 4,
  almost: 4,
  done: 5,
  beyond: 5,
}

export function weeklyProgress(model: Pick<StatsModel, 'pagesByDate'>, target: number, today: string): WeeklyProgress {
  const from = weekStartOf(today)
  const to = addDays(from, 6)
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i)
    return { date, pages: date <= today ? (model.pagesByDate.get(date) ?? 0) : 0 }
  })
  let pages = 0
  let reachedOn: string | undefined
  for (const d of days) {
    pages += d.pages
    if (reachedOn === undefined && d.pages > 0 && pages >= target) reachedOn = d.date
  }
  const share = target > 0 ? pages / target : 0
  const band = bandFor(share, pages)
  const remaining = Math.max(0, target - pages)
  const daysLeft = daysBetween(today, to) + 1
  return {
    target,
    pages,
    share,
    remaining,
    band,
    intensity: INTENSITY[band],
    from,
    to,
    daysLeft,
    perDayNeeded: remaining === 0 ? 0 : Math.ceil(remaining / daysLeft),
    reachedOn,
    days,
  }
}

/**
 * Page to log for "I read N pages today" on a book currently at `currentPage`.
 * Stops at the last page when the book has a page count.
 */
export function pageAfterReading(currentPage: number, pagesToday: number, pageCount?: number): number {
  const to = currentPage + pagesToday
  return pageCount ? Math.min(to, pageCount) : to
}
