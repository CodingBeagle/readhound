/**
 * Achievements (design doc, Achievements). Like the old milestones, every
 * achievement is worked out from the data: the unlock date is the day the
 * condition first became true, so imports, edits and deleted sessions keep
 * them right and nothing but "already celebrated" needs storing.
 */
import { addDays, daysBetween, weekdayOf } from './stats/calendar'
import type { StatRead, StatsModel } from './stats/model'
import type { Goal } from './types'

export const TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const
export type Tier = (typeof TIERS)[number]

export type AchievementGroup = 'reading' | 'habits' | 'variety' | 'collection' | 'special'

/** Points per tier; a one-off special is worth as much as silver. */
export const TIER_POINTS: Record<Tier | 'special', number> = { bronze: 10, silver: 25, gold: 50, platinum: 100, special: 25 }

export const FAMILIES = [
  'bookworm',
  'pageTurner',
  'marathoner',
  'speedReader',
  'onARoll',
  'devoted',
  'goalGetter',
  'explorer',
  'globetrotter',
  'polyglot',
  'timeTraveller',
  'superfan',
  'rereader',
  'collector',
] as const
export type Family = (typeof FAMILIES)[number]

export const SPECIALS = [
  'firstChapter',
  'bigDay',
  'weekendBinge',
  'nightOwl',
  'earlyBird',
  'doorstopper',
  'shortAndSweet',
  'classic',
  'hotOffThePress',
  'lostInTranslation',
  'everyMonth',
  'lifeIsShort',
  'critic',
] as const
export type Special = (typeof SPECIALS)[number]

/** Thresholds for bronze, silver, gold and platinum, plus the group the family is shown in. */
export const FAMILY_RULES: Record<Family, { group: AchievementGroup; thresholds: [number, number, number, number] }> = {
  bookworm: { group: 'reading', thresholds: [5, 15, 30, 60] },
  pageTurner: { group: 'reading', thresholds: [1_000, 5_000, 15_000, 40_000] },
  marathoner: { group: 'reading', thresholds: [1, 3, 6, 12] },
  speedReader: { group: 'reading', thresholds: [1, 3, 8, 20] },
  onARoll: { group: 'habits', thresholds: [7, 30, 60, 100] },
  devoted: { group: 'habits', thresholds: [30, 100, 250, 500] },
  goalGetter: { group: 'habits', thresholds: [1, 2, 3, 5] },
  explorer: { group: 'variety', thresholds: [3, 5, 8, 12] },
  globetrotter: { group: 'variety', thresholds: [3, 6, 10, 20] },
  polyglot: { group: 'variety', thresholds: [2, 3, 4, 5] },
  timeTraveller: { group: 'variety', thresholds: [3, 5, 8, 10] },
  superfan: { group: 'collection', thresholds: [3, 5, 8, 12] },
  rereader: { group: 'collection', thresholds: [1, 3, 6, 10] },
  collector: { group: 'collection', thresholds: [25, 50, 100, 250] },
}

/** A long book has at least this many pages (Marathoner); Doorstopper and Short and sweet use their own. */
export const LONG_BOOK = 500
export const DOORSTOPPER = 800
export const SHORT_BOOK = 150
export const FAST_READ_DAYS = 7
export const BIG_DAY_PAGES = 100
export const WEEKEND_PAGES = 250
export const CLASSIC_BEFORE = 1900
export const CRITIC_RATINGS = 10

export interface TierState {
  tier: Tier
  threshold: number
  unlockedOn?: string
  unlocked: boolean
}

export interface FamilyAchievement {
  kind: 'family'
  id: Family
  group: AchievementGroup
  /** The running count the tiers are measured against. */
  value: number
  tiers: TierState[]
  /** Highest tier reached, if any. */
  tier?: Tier
  /** The next tier to reach, if any is left. */
  next?: TierState
}

export interface SpecialAchievement {
  kind: 'special'
  id: Special
  group: 'special'
  unlocked: boolean
  /** Undefined when locked, or when the data has no date for it (ratings). */
  unlockedOn?: string
  /** Progress where it can be counted, e.g. ratings given. */
  progress?: { value: number; target: number }
}

export type Achievement = FamilyAchievement | SpecialAchievement

/** One unlock: a family tier or a special. Its id is what gets stored once celebrated. */
export interface Unlock {
  id: string
  achievement: Family | Special
  tier: Tier | 'special'
  unlockedOn?: string
  points: number
}

export interface AchievementsInput {
  model: StatsModel
  goals: readonly Goal[]
}

export interface AchievementSummary {
  families: FamilyAchievement[]
  specials: SpecialAchievement[]
  unlocks: Unlock[]
  points: number
  level: Level
  /** Unlockable steps in total (every tier of every family, plus specials). */
  total: number
}

// ---------- Levels ----------

export const LEVELS = ['puppy', 'fetcher', 'sniffer', 'tracker', 'bloodhound', 'readhound'] as const
export type LevelName = (typeof LEVELS)[number]
const LEVEL_POINTS = [0, 100, 300, 700, 1300, 2100]

export interface Level {
  index: number
  name: LevelName
  points: number
  /** Points where this level starts and the next one starts (undefined at the top). */
  from: number
  to?: number
}

export function levelFor(points: number): Level {
  let index = 0
  while (index + 1 < LEVEL_POINTS.length && points >= LEVEL_POINTS[index + 1]!) index++
  return { index, name: LEVELS[index]!, points, from: LEVEL_POINTS[index]!, to: LEVEL_POINTS[index + 1] }
}

// ---------- Rules ----------

const byDate = (a?: string, b?: string) => (a ?? '').localeCompare(b ?? '')

/** The date each new distinct key first appeared, in order. */
function firstSeen<T>(items: readonly T[], date: (item: T) => string | undefined, keys: (item: T) => readonly (string | number | undefined)[]): string[] {
  const seen = new Set<string | number>()
  const dates: string[] = []
  for (const item of [...items].sort((a, b) => byDate(date(a), date(b)))) {
    const d = date(item)
    if (!d) continue
    for (const key of keys(item)) {
      if (key === undefined || seen.has(key)) continue
      seen.add(key)
      dates.push(d)
    }
  }
  return dates
}

function family(id: Family, value: number, dates: readonly (string | undefined)[]): FamilyAchievement {
  const { group, thresholds } = FAMILY_RULES[id]
  const tiers = TIERS.map((tier, i) => {
    const threshold = thresholds[i]!
    const unlocked = value >= threshold
    return { tier, threshold, unlocked, unlockedOn: unlocked ? dates[threshold - 1] : undefined }
  })
  const reached = tiers.filter((t) => t.unlocked)
  return { kind: 'family', id, group, value, tiers, tier: reached.at(-1)?.tier, next: tiers.find((t) => !t.unlocked) }
}

/** Day by day, the date a running total first reached each threshold. */
function runningDates(perDate: ReadonlyMap<string, number>, thresholds: readonly number[]): Map<number, string> {
  const out = new Map<number, string>()
  let total = 0
  for (const [date, n] of [...perDate].sort(([a], [b]) => a.localeCompare(b))) {
    total += n
    for (const t of thresholds) if (total >= t && !out.has(t)) out.set(t, date)
  }
  return out
}

function special(id: Special, unlockedOn: string | undefined, progress?: { value: number; target: number }): SpecialAchievement {
  const unlocked = progress ? progress.value >= progress.target : unlockedOn !== undefined
  return { kind: 'special', id, group: 'special', unlocked, unlockedOn: unlocked ? unlockedOn : undefined, progress }
}

export function achievements({ model, goals }: AchievementsInput): AchievementSummary {
  const finished = model.reads.filter((r): r is StatRead & { endedOn: string } => r.outcome === 'finished' && !!r.endedOn).sort((a, b) => byDate(a.endedOn, b.endedOn))
  const finishedDates = finished.map((r) => r.endedOn)
  const days = [...new Set(model.sessions.map((s) => s.date))].sort()
  const families: FamilyAchievement[] = []

  // Reading
  families.push(family('bookworm', finished.length, finishedDates))
  const pageThresholds = FAMILY_RULES.pageTurner.thresholds
  const pageDates = runningDates(model.pagesByDate, pageThresholds)
  const pages = [...model.pagesByDate.values()].reduce((sum, n) => sum + n, 0)
  families.push(family('pageTurner', pages, sparse(pageThresholds, pageDates)))
  const long = finished.filter((r) => (r.book.pageCount ?? 0) >= LONG_BOOK)
  families.push(family('marathoner', long.length, long.map((r) => r.endedOn)))
  const fast = finished.filter((r) => daysBetween(r.startedOn, r.endedOn) < FAST_READ_DAYS)
  families.push(family('speedReader', fast.length, fast.map((r) => r.endedOn)))

  // Habits: the streak tiers unlock on the day a run first reached them.
  const streakThresholds = FAMILY_RULES.onARoll.thresholds
  const streakDates = new Map<number, string>()
  let run = 0
  let best = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && daysBetween(days[i - 1]!, days[i]!) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    for (const t of streakThresholds) if (run >= t && !streakDates.has(t)) streakDates.set(t, days[i]!)
  }
  families.push(family('onARoll', best, sparse(streakThresholds, streakDates)))
  families.push(family('devoted', days.length, days))
  const goalDates = goals
    .map((goal) => goalReachedOn(goal, finished, model.pagesByDate))
    .filter((d): d is string => d !== undefined)
    .sort()
  families.push(family('goalGetter', goalDates.length, goalDates))

  // Variety
  const genres = firstSeen(finished, (r) => r.endedOn, (r) => r.book.genres.map((g) => g.id))
  families.push(family('explorer', genres.length, genres))
  const countries = firstSeen(finished, (r) => r.endedOn, (r) => r.book.authors.map((a) => a.country))
  families.push(family('globetrotter', countries.length, countries))
  const languages = firstSeen(finished, (r) => r.endedOn, (r) => [r.book.language])
  families.push(family('polyglot', languages.length, languages))
  const decades = firstSeen(finished, (r) => r.endedOn, (r) => [r.book.firstPublishYear === undefined ? undefined : Math.floor(r.book.firstPublishYear / 10) * 10])
  families.push(family('timeTraveller', decades.length, decades))

  // Collection
  const perAuthor = new Map<string, string[]>()
  for (const r of finished) for (const a of r.book.authors) perAuthor.set(a.id, [...(perAuthor.get(a.id) ?? []), r.endedOn])
  const fan = Math.max(0, ...[...perAuthor.values()].map((d) => d.length))
  // A tier unlocks the day any one author reached that many finished books.
  const fanDates = new Map<number, string>()
  for (const t of FAMILY_RULES.superfan.thresholds) {
    const first = [...perAuthor.values()].flatMap((d) => (d[t - 1] ? [d[t - 1]!] : [])).sort()[0]
    if (first) fanDates.set(t, first)
  }
  families.push(family('superfan', fan, sparse(FAMILY_RULES.superfan.thresholds, fanDates)))
  const seenWorks = new Set<string>()
  const rereadDates: string[] = []
  for (const r of finished) {
    if (seenWorks.has(r.book.workId)) rereadDates.push(r.endedOn)
    seenWorks.add(r.book.workId)
  }
  families.push(family('rereader', rereadDates.length, rereadDates))
  const added = model.books.map((b) => b.entry.addedAt.slice(0, 10)).sort()
  families.push(family('collector', added.length, added))

  // Specials
  const specials: SpecialAchievement[] = []
  specials.push(special('firstChapter', finishedDates[0]))
  specials.push(special('bigDay', [...model.pagesByDate].filter(([, n]) => n >= BIG_DAY_PAGES).map(([d]) => d).sort()[0]))
  specials.push(special('weekendBinge', weekendBinge(model.pagesByDate)))
  const sessionsByDate = [...model.sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  specials.push(special('nightOwl', sessionsByDate.find((s) => s.hour >= 23 || s.hour < 4)?.date))
  specials.push(special('earlyBird', sessionsByDate.find((s) => s.hour >= 5 && s.hour < 7)?.date))
  specials.push(special('doorstopper', finished.find((r) => (r.book.pageCount ?? 0) >= DOORSTOPPER)?.endedOn))
  specials.push(special('shortAndSweet', finished.find((r) => r.book.pageCount !== undefined && r.book.pageCount > 0 && r.book.pageCount < SHORT_BOOK)?.endedOn))
  specials.push(special('classic', finished.find((r) => r.book.firstPublishYear !== undefined && r.book.firstPublishYear < CLASSIC_BEFORE)?.endedOn))
  specials.push(special('hotOffThePress', finished.find((r) => r.book.firstPublishYear === Number(r.endedOn.slice(0, 4)))?.endedOn))
  specials.push(
    special(
      'lostInTranslation',
      finished.find((r) => r.book.originalLanguage && r.book.language && r.book.originalLanguage !== r.book.language)?.endedOn,
    ),
  )
  specials.push(special('everyMonth', everyMonth(days)))
  specials.push(
    special(
      'lifeIsShort',
      model.reads
        .filter((r) => r.outcome === 'dnf' && r.endedOn)
        .map((r) => r.endedOn!)
        .sort()[0],
    ),
  )
  const rated = model.books.filter((b) => b.entry.rating !== undefined).length
  specials.push(special('critic', undefined, { value: Math.min(rated, CRITIC_RATINGS), target: CRITIC_RATINGS }))

  const unlocks: Unlock[] = [
    ...families.flatMap((f) =>
      f.tiers.filter((t) => t.unlocked).map((t) => ({ id: `${f.id}:${t.tier}`, achievement: f.id, tier: t.tier, unlockedOn: t.unlockedOn, points: TIER_POINTS[t.tier] })),
    ),
    ...specials.filter((s) => s.unlocked).map((s) => ({ id: s.id, achievement: s.id, tier: 'special' as const, unlockedOn: s.unlockedOn, points: TIER_POINTS.special })),
  ]
  const points = unlocks.reduce((sum, u) => sum + u.points, 0)
  return { families, specials, unlocks, points, level: levelFor(points), total: families.length * TIERS.length + specials.length }
}

/** Turns threshold → date into a list indexed by `threshold - 1`, as `family` expects. */
function sparse(thresholds: readonly number[], dates: ReadonlyMap<number, string>): (string | undefined)[] {
  const out: (string | undefined)[] = []
  for (const t of thresholds) out[t - 1] = dates.get(t)
  return out
}

/** The day a yearly goal was met, by books or pages (whichever is set; both must be met when both are). */
function goalReachedOn(goal: Goal, finished: readonly (StatRead & { endedOn: string })[], pagesByDate: ReadonlyMap<string, number>): string | undefined {
  const year = String(goal.year)
  const dates: string[] = []
  if (goal.targetBooks) {
    const inYear = finished.filter((r) => r.endedOn.startsWith(year))
    const d = inYear[goal.targetBooks - 1]?.endedOn
    if (!d) return undefined
    dates.push(d)
  }
  if (goal.targetPages) {
    const d = runningDates(new Map([...pagesByDate].filter(([date]) => date.startsWith(year))), [goal.targetPages]).get(goal.targetPages)
    if (!d) return undefined
    dates.push(d)
  }
  return dates.sort().at(-1)
}

/** The day the first weekend reached WEEKEND_PAGES pages over Saturday and Sunday together. */
function weekendBinge(pagesByDate: ReadonlyMap<string, number>): string | undefined {
  const saturdays = new Set<string>()
  for (const date of pagesByDate.keys()) {
    const weekday = weekdayOf(date)
    if (weekday === 5) saturdays.add(date)
    if (weekday === 6) saturdays.add(addDays(date, -1))
  }
  for (const saturday of [...saturdays].sort()) {
    const sat = pagesByDate.get(saturday) ?? 0
    if (sat >= WEEKEND_PAGES) return saturday
    if (sat + (pagesByDate.get(addDays(saturday, 1)) ?? 0) >= WEEKEND_PAGES) return addDays(saturday, 1)
  }
  return undefined
}

/** The day you first had read in all twelve months of one calendar year. */
function everyMonth(days: readonly string[]): string | undefined {
  const months = new Map<string, Set<string>>()
  for (const d of days) {
    const year = d.slice(0, 4)
    const set = months.get(year) ?? new Set()
    set.add(d.slice(5, 7))
    months.set(year, set)
    if (set.size === 12) return d
  }
  return undefined
}
