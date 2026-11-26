import type { BuddyState, Milestone } from '@/domain/buddy'
import type { WeeklyProgress } from '@/domain/weeklyGoal'
import { t } from '@/i18n'

const b = t.buddy

const pick = <T,>(list: readonly T[], n: number): T => list[n % list.length]!

/** The speech bubble for a mood, stable for the day, moving on with each tap. */
export function buddyMessage(state: BuddyState, seed: number, pokes: number): string {
  if (pokes > 0) return pick(b.poked[state.mood], seed + pokes - 1)
  const n = seed
  const m = state.milestone
  if (m) return milestoneMessage(m, n)
  const w = state.weekly
  // With a weekly goal the buddy talks about the week, unless it is dozing through an empty one.
  if (w && !(w.band === 'none' && (state.mood === 'sleepy' || state.mood === 'snoozing'))) return pick(weeklyMessages(w), n)
  switch (state.mood) {
    case 'happy':
      if (state.streak >= 2) return pick(b.happy.streak(state.streak), n)
      return pick(state.daysSinceReading === 0 ? b.happy.today : b.happy.general, n)
    case 'curious':
      if (state.empty) return pick(b.curious.empty, n)
      if (state.readingTitle) return pick(b.curious.reading(state.readingTitle), n)
      return pick(b.curious.nothingLogged, n)
    case 'sleepy':
      return pick(b.sleepy(state.daysSinceReading ?? 0), n)
    default:
      return pick(b.snoozing(state.daysSinceReading ?? 0), n)
  }
}

/** The lines for this week's progress band. */
export function weeklyMessages(w: WeeklyProgress): readonly string[] {
  const f = (n: number) => n.toLocaleString('en')
  return b.weekly[w.band]({ pages: f(w.pages), target: f(w.target), remaining: f(w.remaining), perDay: f(w.perDayNeeded), daysLeft: w.daysLeft })
}

function milestoneMessage(m: Milestone, n: number): string {
  switch (m.kind) {
    case 'weekly':
      return pick(b.milestone.weekly(m.target.toLocaleString('en')), n)
    case 'goal':
      return pick(m.unit === 'books' ? b.milestone.goalBooks(m.target) : b.milestone.goalPages(m.target.toLocaleString('en')), n)
    case 'finished':
      return pick(b.milestone.finished(m.title), n)
    case 'streak':
      return pick(b.milestone.streak(m.days), n)
    case 'achievement': {
      const a = t.achievements
      const name = m.tier === 'special' ? a.specials[m.achievement as keyof typeof a.specials].name : a.families[m.achievement as keyof typeof a.families].name
      return pick(b.milestone.achievement(name), n)
    }
  }
}

