/**
 * Beagle buddy: Zico, the mascot on Home whose mood follows the reader's reading
 * (design doc, Beagle buddy). Everything here is pure so the rules can be
 * tested against a fixed model and date.
 */
import type { Family, Special, Tier, Unlock } from './achievements'
import { addDays, daysBetween } from './stats/calendar'
import { currentStreak, readingDays } from './stats/habits'
import type { StatsModel } from './stats/model'
import type { Goal } from './types'
import { weeklyProgress, type WeeklyProgress } from './weeklyGoal'

export const BUDDY_MOODS = ['excited', 'happy', 'curious', 'sleepy', 'snoozing'] as const
/** Settings key set once Zico has introduced himself, so his greeting shows only the first time. */
export const SETTING_BUDDY_INTRODUCED = 'buddyIntroduced'

export type BuddyMood = (typeof BUDDY_MOODS)[number]

/** A milestone counts as fresh, and keeps the buddy excited, for this many days after it happened. */
export const MILESTONE_FRESH_DAYS = 2
/** Days without a reading session before the buddy gets sleepy, and before it falls asleep. */
export const SLEEPY_AFTER_DAYS = 4
export const SNOOZE_AFTER_DAYS = 14
/** Streak lengths worth a cheer. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const

export type Milestone =
  | { kind: 'goal'; key: string; on: string; unit: 'books' | 'pages'; target: number }
  | { kind: 'weekly'; key: string; on: string; target: number }
  | { kind: 'finished'; key: string; on: string; title: string }
  | { kind: 'achievement'; key: string; on: string; achievement: Family | Special; tier: Tier | 'special' }
  | { kind: 'streak'; key: string; on: string; days: number }

export interface BuddyState {
  mood: BuddyMood
  /** The freshest milestone, when there is one; the reason for an excited mood. */
  milestone?: Milestone
  /** Days since the last reading session; undefined when nothing has been logged. */
  daysSinceReading?: number
  streak: number
  /** Title of a book being read, for curious messages. */
  readingTitle?: string
  /** True when the library is empty. */
  empty: boolean
  /** This week's progress, when a weekly pages goal is set. */
  weekly?: WeeklyProgress
}

export interface BuddyInput {
  model: StatsModel
  goals: readonly Goal[]
  unlocks: readonly Unlock[]
  today: string
  /** Weekly pages target, when one is set. */
  weeklyTarget?: number
}

const fresh = (on: string | undefined, today: string): on is string => on !== undefined && on <= today && daysBetween(on, today) <= MILESTONE_FRESH_DAYS

/** The date the year's goal was reached, if it was. */
function goalReachedOn(model: StatsModel, goal: Goal, unit: 'books' | 'pages', today: string): string | undefined {
  const from = `${goal.year}-01-01`
  const to = `${goal.year}-12-31`
  if (unit === 'books') {
    const target = goal.targetBooks
    if (!target) return undefined
    const ends = model.reads
      .filter((r) => r.outcome === 'finished' && r.endedOn && r.endedOn >= from && r.endedOn <= to && r.endedOn <= today)
      .map((r) => r.endedOn!)
      .sort()
    return ends[target - 1]
  }
  const target = goal.targetPages
  if (!target) return undefined
  let sum = 0
  for (const [date, pages] of [...model.pagesByDate].filter(([d]) => d >= from && d <= to && d <= today).sort(([a], [b]) => a.localeCompare(b))) {
    sum += pages
    if (sum >= target) return date
  }
  return undefined
}

/** Every fresh milestone, most important first: a reached goal, a finished book, an achievement, a streak. */
export function freshMilestones({ model, goals, unlocks, today, weeklyTarget }: BuddyInput): Milestone[] {
  const out: Milestone[] = []
  const year = Number(today.slice(0, 4))
  const goal = goals.find((g) => g.year === year)
  if (goal) {
    for (const unit of ['books', 'pages'] as const) {
      const on = goalReachedOn(model, goal, unit, today)
      const target = unit === 'books' ? goal.targetBooks : goal.targetPages
      if (fresh(on, today) && target) out.push({ kind: 'goal', key: `goal:${year}:${unit}`, on, unit, target })
    }
  }
  if (weeklyTarget) {
    // One cheer per week, even if the target changes after it was reached.
    const week = weeklyProgress(model, weeklyTarget, today)
    if (fresh(week.reachedOn, today)) out.push({ kind: 'weekly', key: `weekly:${week.from}`, on: week.reachedOn, target: weeklyTarget })
  }
  const finished = model.reads
    .filter((r) => r.outcome === 'finished' && fresh(r.endedOn, today))
    .sort((a, b) => b.endedOn!.localeCompare(a.endedOn!))
  for (const r of finished) out.push({ kind: 'finished', key: `finished:${r.id}`, on: r.endedOn!, title: r.book.title })
  const unlocked = unlocks.filter((u) => fresh(u.unlockedOn, today)).sort((a, b) => b.points - a.points || b.unlockedOn!.localeCompare(a.unlockedOn!))
  for (const u of unlocked) out.push({ kind: 'achievement', key: `achievement:${u.id}`, on: u.unlockedOn!, achievement: u.achievement, tier: u.tier })
  const streak = currentStreak(model, today)
  if (streak.from) {
    const reached = [...STREAK_MILESTONES].reverse().find((m) => m <= streak.length && fresh(addDays(streak.from!, m - 1), today))
    if (reached) out.push({ kind: 'streak', key: `streak:${streak.from}:${reached}`, on: addDays(streak.from, reached - 1), days: reached })
  }
  return out
}

/** How the buddy feels today, and why. */
export function buddyState(input: BuddyInput): BuddyState {
  const { model, today } = input
  const streak = currentStreak(model, today).length
  const days = readingDays(model).filter((d) => d <= today)
  const last = days.at(-1)
  const daysSinceReading = last === undefined ? undefined : daysBetween(last, today)
  const reading = model.reads.filter((r) => r.outcome === undefined && r.book.entry.status === 'reading')
  const readingTitle = reading.sort((a, b) => (b.sessions.at(-1)?.date ?? b.startedOn).localeCompare(a.sessions.at(-1)?.date ?? a.startedOn))[0]?.book.title
  const empty = model.books.length === 0
  const milestone = freshMilestones(input)[0]
  const weekly = input.weeklyTarget ? weeklyProgress(model, input.weeklyTarget, today) : undefined
  const base = { daysSinceReading, streak, readingTitle, empty, weekly }
  if (milestone) return { ...base, mood: 'excited', milestone }
  const mood = moodFor(daysSinceReading, readingTitle !== undefined, empty)
  // Closing in on the weekly goal gets the buddy excited.
  if (weekly && EXCITED_BANDS.has(weekly.band) && (mood === 'happy' || mood === 'curious')) return { ...base, mood: 'excited' }
  return { ...base, mood }
}

const EXCITED_BANDS = new Set<WeeklyProgress['band']>(['close', 'almost', 'done', 'beyond'])

function moodFor(daysSince: number | undefined, reading: boolean, empty: boolean): BuddyMood {
  if (empty) return 'curious'
  if (daysSince === undefined) return 'curious'
  if (daysSince >= SNOOZE_AFTER_DAYS) return 'snoozing'
  if (daysSince >= SLEEPY_AFTER_DAYS) return 'sleepy'
  if (daysSince <= 1) return 'happy'
  return reading ? 'curious' : 'happy'
}

/** A small stable number for a string, to pick a message that stays put for the day. */
export function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}
