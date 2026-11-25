/**
 * Every stat against a small data set whose answers were worked out by hand
 * (design doc, acceptance criterion 7). The arithmetic is in the comments.
 */
import type { Author, Category, Edition, LibraryEntry, Read, ReadingSession, Work } from '../types'
import {
  attributeReads,
  authorCountries,
  booksRead,
  buildStatsModel,
  currentStreak,
  fictionSplit,
  finishForecast,
  genresOverTime,
  goalPace,
  heatmap,
  languages,
  lengthDistribution,
  longestStreak,
  milestones,
  newVsReturningAuthors,
  originalsVsTranslations,
  pagesByWeekdayAndHour,
  pagesPerDay,
  pagesRead,
  perMonth,
  periodFor,
  publicationDecades,
  ratingsByGenre,
  ratingsVsLength,
  readingSpeedInPeriod,
  rereads,
  stackHeight,
  startedVsFinished,
  timeToFinish,
  toReadPile,
  topAuthors,
  waitBeforeStarting,
  whereIStop,
  yearInReview,
  reviewYears,
} from './index'

const TODAY = '2026-06-15'
const TZ = 'Europe/Copenhagen'

const authors: Author[] = [
  { id: 'a1', name: 'Peter Høeg', country: 'DK', overrides: {} },
  { id: 'a2', name: 'Andy Weir', country: 'US', overrides: {} },
  { id: 'a3', name: 'Ursula K. Le Guin', overrides: {} },
]
const work = (id: string, title: string, authorId: string, originalLanguage: string, year: number): Work => ({
  id,
  title,
  authorIds: [authorId],
  originalLanguage,
  firstPublishYear: year,
  subjects: [],
})
const works = [
  work('w1', 'Frøken Smillas fornemmelse for sne', 'a1', 'dan', 1992),
  work('w2', 'The Martian', 'a2', 'eng', 2011),
  work('w3', 'Project Hail Mary', 'a2', 'eng', 2021),
  work('w4', 'A Wizard of Earthsea', 'a3', 'eng', 1968),
  work('w5', 'The Dispossessed', 'a3', 'eng', 1974),
]
const edition = (id: string, workId: string, language: string, pageCount: number): Edition => ({
  id,
  workId,
  title: works.find((w) => w.id === workId)!.title,
  language,
  pageCount,
  borrowed: {},
  overrides: {},
})
const editions = [edition('e1', 'w1', 'dan', 400), edition('e2', 'w2', 'eng', 300), edition('e3', 'w3', 'eng', 500), edition('e4', 'w4', 'dan', 180), edition('e5', 'w5', 'eng', 250)]
const categories: Category[] = [
  { id: 'crime', name: 'Krimi', kind: 'genre', isFiction: true },
  { id: 'scifi', name: 'Science fiction', kind: 'genre', isFiction: true },
  { id: 'fav', name: 'Favourites', kind: 'shelf' },
]
const entry = (id: string, editionId: string, status: LibraryEntry['status'], addedOn: string, categoryIds: string[], rating?: number): LibraryEntry => ({
  id,
  editionId,
  status,
  addedAt: `${addedOn}T10:00:00.000Z`,
  statusChangedAt: `${addedOn}T10:00:00.000Z`,
  categoryIds,
  favourite: false,
  rating,
})
const entries = [
  entry('n1', 'e1', 'finished', '2025-12-01', ['crime', 'fav'], 4),
  entry('n2', 'e2', 'finished', '2025-01-01', ['scifi'], 5),
  entry('n3', 'e3', 'reading', '2026-05-01', ['scifi']),
  entry('n4', 'e4', 'dnf', '2026-01-10', [], 2),
  entry('n5', 'e5', 'to_read', '2025-06-15', []),
]
const reads: Read[] = [
  { id: 'r1', entryId: 'n1', startedOn: '2026-01-05', endedOn: '2026-01-07', outcome: 'finished' },
  { id: 'r2', entryId: 'n2', startedOn: '2025-03-01', endedOn: '2025-03-10', outcome: 'finished' }, // no sessions: 300 pages on 2025-03-10
  { id: 'r3', entryId: 'n2', startedOn: '2026-02-01', endedOn: '2026-02-03', outcome: 'finished' }, // reread
  { id: 'r4', entryId: 'n4', startedOn: '2026-03-01', endedOn: '2026-03-02', outcome: 'dnf', stoppedAtPage: 45 },
  { id: 'r5', entryId: 'n3', startedOn: '2026-06-10' },
]
let n = 0
// 18:00 UTC is 19:00 in Copenhagen in winter and 20:00 in summer.
const session = (readId: string, date: string, fromPage: number, toPage: number, durationMinutes?: number): ReadingSession => ({
  id: `s${++n}`,
  readId,
  startedAt: `${date}T18:00:00.000Z`,
  timeZone: TZ,
  fromPage,
  toPage,
  pagesRead: toPage - fromPage,
  durationMinutes,
})
const sessions = [
  session('r1', '2026-01-05', 0, 100, 60), // Monday
  session('r1', '2026-01-06', 100, 250, 90), // Tuesday
  session('r1', '2026-01-07', 250, 400), // Wednesday, no duration
  session('r3', '2026-02-01', 0, 150, 120), // Sunday
  session('r3', '2026-02-03', 150, 300, 60), // Tuesday
  session('r4', '2026-03-01', 0, 45, 30), // Sunday
  session('r5', '2026-06-10', 0, 50, 30), // Wednesday
  session('r5', '2026-06-14', 50, 120, 30), // Sunday
  session('r5', '2026-06-15', 120, 150, 30), // Monday
]

const model = buildStatsModel({ entries, editions, works, authors, reads, sessions, categories })
const year2026 = periodFor('this_year', TODAY)
const all = periodFor('all', TODAY)

describe('totals', () => {
  it('counts books read by end date, rereads included', () => {
    expect(booksRead(model, year2026)).toEqual({ total: 2, unique: 2 }) // r1, r3
    expect(booksRead(model, all)).toEqual({ total: 3, unique: 2 }) // r2 and r3 are the same work
  })

  it('counts pages from sessions, DNF included, plus finished reads without sessions', () => {
    expect(pagesRead(model, year2026)).toBe(895) // 400 + 300 + 45 + 150
    expect(pagesRead(model, all)).toBe(1195) // + 300 on 2025-03-10
  })

  it('splits books and pages per month up to today', () => {
    expect(perMonth(model, year2026, TODAY)).toEqual([
      { month: '2026-01', books: 1, pages: 400 },
      { month: '2026-02', books: 1, pages: 300 },
      { month: '2026-03', books: 0, pages: 45 },
      { month: '2026-04', books: 0, pages: 0 },
      { month: '2026-05', books: 0, pages: 0 },
      { month: '2026-06', books: 0, pages: 150 },
    ])
  })

  it('works out goal pace', () => {
    // 15 June is day 166 of 365: expected 12 × 166 / 365 = 5.46, so 2 − 5.46 ≈ 3 behind.
    const pace = goalPace(12, 2, 2026, TODAY)
    expect(pace.expected).toBeCloseTo(5.4575, 3)
    expect(pace.difference).toBe(-3)
    expect(goalPace(12, 12, 2025, TODAY).difference).toBe(0) // a past year is fully elapsed
  })

  it('averages pages per day and per reading day', () => {
    const { perDay, perReadingDay } = pagesPerDay(model, year2026, TODAY)
    expect(perDay).toBeCloseTo(895 / 166) // 1 Jan to 15 Jun is 166 days
    expect(perReadingDay).toBeCloseTo(895 / 9) // 9 days with sessions
  })

  it('compares reads started, finished and abandoned', () => {
    expect(startedVsFinished(model, year2026)).toEqual({ started: 4, finished: 2, dnf: 1 })
  })

  it('includes DNF reads in attribute stats only when asked', () => {
    expect(attributeReads(model, year2026).map((r) => r.id)).toEqual(['r1', 'r3'])
    expect(attributeReads(model, year2026, true).map((r) => r.id)).toEqual(['r1', 'r3', 'r4'])
  })
})

describe('habits', () => {
  it('finds the current and longest streaks', () => {
    expect(currentStreak(model, TODAY)).toEqual({ length: 2, from: '2026-06-14', to: '2026-06-15' })
    expect(currentStreak(model, '2026-06-16')).toEqual({ length: 2, from: '2026-06-14', to: '2026-06-15' }) // yesterday still counts
    expect(currentStreak(model, '2026-06-17').length).toBe(0)
    expect(longestStreak(model)).toEqual({ length: 3, from: '2026-01-05', to: '2026-01-07' })
  })

  it('builds a 365-day heatmap with intensity steps', () => {
    const days = heatmap(model, TODAY)
    expect(days).toHaveLength(365)
    expect(days.at(-1)).toMatchObject({ date: TODAY, pages: 30 })
    expect(days.filter((d) => d.level > 0)).toHaveLength(9)
    expect(days.find((d) => d.date === '2026-01-06')?.level).toBe(4) // 150 pages, among the biggest days
    expect(days.at(-1)?.level).toBe(1) // 30 pages, the smallest day
  })

  it('groups pages by weekday and local hour', () => {
    const { weekday, hour } = pagesByWeekdayAndHour(model, year2026)
    // Mon 100 + 30, Tue 150 + 150, Wed 150 + 50, Sun 150 + 45 + 70
    expect(weekday).toEqual([130, 300, 200, 0, 0, 0, 265])
    expect(hour[19]).toBe(745) // winter sessions
    expect(hour[20]).toBe(150) // summer sessions
  })

  it('measures reading speed over timed sessions only', () => {
    // 745 pages in 450 minutes
    expect(readingSpeedInPeriod(model, year2026).overall).toBeCloseTo((745 / 450) * 60)
  })

  it('forecasts the finish date from the last 14 days', () => {
    // 150 pages in 14 days = 10.7/day; 350 left → 33 days → 18 July
    const open = model.reads.find((r) => r.id === 'r5')!
    expect(finishForecast(open, TODAY)?.date).toBe('2026-07-18')
    expect(finishForecast(open, '2026-07-30')).toBeUndefined() // nothing read lately
  })

  it('lists time to finish, fastest first', () => {
    expect(timeToFinish(model, year2026).map((t) => [t.read.book.title, t.days])).toEqual([
      ['Frøken Smillas fornemmelse for sne', 3],
      ['The Martian', 3],
    ])
  })
})

describe('what I read', () => {
  it('counts genres over time, ignoring shelves', () => {
    expect(genresOverTime(model, year2026, 'month')).toEqual([
      { bucket: '2026-01', genres: { crime: 1 } },
      { bucket: '2026-02', genres: { scifi: 1 } },
    ])
    expect(genresOverTime(model, year2026, 'year', true)).toEqual([{ bucket: '2026', genres: { crime: 1, scifi: 1, unknown: 1 } }])
  })

  it('ranks authors and splits new from returning', () => {
    expect(topAuthors(model, all)[0]).toEqual({ authorId: 'a2', name: 'Andy Weir', count: 2 })
    expect(newVsReturningAuthors(model, year2026)).toEqual({ new: 1, returning: 1 }) // Weir was read in 2025
    expect(newVsReturningAuthors(model, year2026, true)).toEqual({ new: 2, returning: 1 })
  })

  it('counts languages, translations, decades, lengths and fiction', () => {
    expect(languages(model, year2026, true)).toEqual([
      { key: 'dan', count: 2 },
      { key: 'eng', count: 1 },
    ])
    expect(originalsVsTranslations(model, year2026, true)).toEqual({ original: 2, translated: 1, unknown: 0 })
    expect(publicationDecades(model, year2026)).toEqual([
      { key: 1990, count: 1 },
      { key: 2010, count: 1 },
    ])
    expect(lengthDistribution(model, year2026).buckets.filter((b) => b.count)).toEqual([
      { bucket: '200–349', count: 1 },
      { bucket: '350–499', count: 1 },
    ])
    expect(fictionSplit(model, year2026, true)).toEqual({ fiction: 2, nonfiction: 0, unknown: 1 })
  })

  it('lists rereads, author countries and ratings', () => {
    expect(rereads(model)).toEqual([{ title: 'The Martian', authors: ['Andy Weir'], count: 2 }])
    expect(authorCountries(model, year2026, true)).toEqual([
      { key: 'DK', count: 1 },
      { key: 'US', count: 1 },
      { key: 'unknown', count: 1 },
    ])
    expect(ratingsVsLength(model, year2026)).toEqual([
      { title: 'Frøken Smillas fornemmelse for sne', pages: 400, rating: 4 },
      { title: 'The Martian', pages: 300, rating: 5 },
    ])
    expect(ratingsByGenre(model, all)).toEqual([
      { genreId: 'scifi', average: 5, count: 2 },
      { genreId: 'crime', average: 4, count: 1 },
    ])
  })
})

describe('my library and extras', () => {
  it('describes the to-read pile', () => {
    const pile = toReadPile(model, TODAY)
    expect(pile).toMatchObject({ count: 1, averageWait: 365, longestWait: 365 })
  })

  it('measures the wait before starting', () => {
    // 35, 59, 40 and 50 days
    const wait = waitBeforeStarting(model, all)
    expect(wait.average).toBe(46)
    expect(wait.buckets.map((b) => b.count)).toEqual([0, 0, 4, 0, 0])
  })

  it('shows where DNF reads stop', () => {
    // 45 of 180 pages = 25% → the 20–29% bucket
    expect(whereIStop(model, year2026).buckets[2]).toEqual({ from: 20, count: 1 })
  })

  it('compares the stack with landmarks', () => {
    expect(stackHeight(400_000).landmark.name).toBe('Round Tower') // 40 m
    expect(stackHeight(1195).metres).toBeCloseTo(0.1195)
  })

  it('unlocks milestones on the day the threshold was crossed', () => {
    const list = milestones(model)
    // 300 + 100 + 150 + 150 + 150 + 150 = 1,000 on 3 February
    expect(list.find((m) => m.id === 'pages-1000')?.unlockedOn).toBe('2026-02-03')
    expect(list.find((m) => m.id === 'books-1')?.unlockedOn).toBe('2025-03-10')
    expect(list.find((m) => m.id === 'streak-7')).toMatchObject({ unlockedOn: undefined, progress: 3 / 7 })
    expect(list.find((m) => m.id === 'category-scifi')?.progress).toBeCloseTo(2 / 5)
  })
})

describe('year in review', () => {
  it('summarises a year', () => {
    const review = yearInReview(model, 2026)
    expect(review).toMatchObject({ year: 2026, books: 2, uniqueBooks: 2, pages: 895, readingDays: 9 })
    expect(review.topAuthors).toEqual([
      { name: 'Andy Weir', count: 1 },
      { name: 'Peter Høeg', count: 1 },
    ])
    expect(review.topGenres).toEqual([
      { name: 'Krimi', count: 1 },
      { name: 'Science fiction', count: 1 },
    ])
    expect(review.longest?.title).toBe('Frøken Smillas fornemmelse for sne') // 400 pages
    expect(review.shortest?.title).toBe('The Martian') // 300 pages
    expect(review.fastest).toMatchObject({ title: 'Frøken Smillas fornemmelse for sne', days: 3 }) // tie with The Martian, finished first
    expect(review.highestRated).toMatchObject({ title: 'The Martian', rating: 5 })
    expect(review.streak).toEqual({ length: 3, from: '2026-01-05', to: '2026-01-07' })
    expect(review.first?.endedOn).toBe('2026-01-07')
    expect(review.last?.endedOn).toBe('2026-02-03')
  })

  it('lists the years that have finished books', () => {
    expect(reviewYears(model)).toEqual([2026, 2025])
    expect(yearInReview(model, 2024)).toMatchObject({ books: 0, pages: 0, longest: undefined, streak: { length: 0 } })
  })
})
