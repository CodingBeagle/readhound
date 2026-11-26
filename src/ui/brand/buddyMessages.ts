import type { BuddyState, Milestone } from '@/domain/buddy'
import { t } from '@/i18n'

const b = t.buddy

const pick = <T,>(list: readonly T[], n: number): T => list[n % list.length]!

/** The speech bubble for a mood, stable for the day, moving on with each tap. */
export function buddyMessage(state: BuddyState, seed: number, pokes: number): string {
  if (pokes > 0) return pick(b.poked[state.mood], seed + pokes - 1)
  const n = seed
  const m = state.milestone
  if (m) return milestoneMessage(m, n)
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

function milestoneMessage(m: Milestone, n: number): string {
  switch (m.kind) {
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

