import { buddyState, freshMilestones } from './buddy'
import { buildStatsModel } from './stats'
import type { Edition, Goal, LibraryEntry, Read, ReadingSession, Status, Work } from './types'
import type { Unlock } from './achievements'

const TODAY = '2026-11-26'

function book(id: string, status: Status) {
  const work: Work = { id: `w${id}`, title: `Book ${id}`, authorIds: [], subjects: [] }
  const edition: Edition = { id: `e${id}`, workId: work.id, title: work.title, pageCount: 300, borrowed: {}, overrides: {} }
  const entry: LibraryEntry = { id: `n${id}`, editionId: edition.id, status, addedAt: '2026-01-01T00:00:00Z', statusChangedAt: '2026-01-01T00:00:00Z', categoryIds: [], favourite: false }
  return { work, edition, entry }
}

let sessionCount = 0
const session = (readId: string, date: string, pages = 20): ReadingSession => ({
  id: `s${++sessionCount}`,
  readId,
  startedAt: `${date}T12:00:00Z`,
  timeZone: 'UTC',
  fromPage: 0,
  toPage: pages,
  pagesRead: pages,
})

function state({ reads = [], sessions = [], goals = [], unlocks = [], statuses = ['reading'] as Status[] }: { reads?: Read[]; sessions?: ReadingSession[]; goals?: Goal[]; unlocks?: Unlock[]; statuses?: Status[] }) {
  const books = statuses.map((s, i) => book(String(i + 1), s))
  const model = buildStatsModel({
    entries: books.map((b) => b.entry),
    editions: books.map((b) => b.edition),
    works: books.map((b) => b.work),
    authors: [],
    reads,
    sessions,
    categories: [],
  })
  const input = { model, goals, unlocks, today: TODAY }
  return { ...buddyState(input), milestones: freshMilestones(input) }
}

const current: Read = { id: 'r1', entryId: 'n1', startedOn: '2026-11-01' }

describe('beagle buddy mood', () => {
  it('is curious about an empty library', () => {
    expect(state({ statuses: [] })).toMatchObject({ mood: 'curious', empty: true })
  })

  it('is happy after reading today or yesterday', () => {
    expect(state({ reads: [current], sessions: [session('r1', TODAY)] }).mood).toBe('happy')
    expect(state({ reads: [current], sessions: [session('r1', '2026-11-25')] }).mood).toBe('happy')
  })

  it('is curious about the current book after a couple of days off', () => {
    expect(state({ reads: [current], sessions: [session('r1', '2026-11-23')] })).toMatchObject({ mood: 'curious', readingTitle: 'Book 1', daysSinceReading: 3 })
  })

  it('gets sleepy after four days and snoozes after two weeks', () => {
    expect(state({ reads: [current], sessions: [session('r1', '2026-11-22')] }).mood).toBe('sleepy')
    expect(state({ reads: [current], sessions: [session('r1', '2026-11-12')] })).toMatchObject({ mood: 'snoozing', daysSinceReading: 14 })
  })

  it('is excited about a book finished in the last two days, but not an older one', () => {
    const finished = (endedOn: string): Read => ({ id: 'r1', entryId: 'n1', startedOn: '2026-11-01', endedOn, outcome: 'finished' })
    const fresh = state({ statuses: ['finished'], reads: [finished('2026-11-24')], sessions: [session('r1', '2026-11-24')] })
    expect(fresh).toMatchObject({ mood: 'excited', milestone: { kind: 'finished', title: 'Book 1', key: 'finished:r1' } })
    expect(state({ statuses: ['finished'], reads: [finished('2026-11-20')], sessions: [session('r1', '2026-11-20')] }).mood).toBe('sleepy')
  })

  it('puts a goal reached on the same day ahead of the finished book', () => {
    const reads: Read[] = [
      { id: 'r1', entryId: 'n1', startedOn: '2026-10-01', endedOn: '2026-10-10', outcome: 'finished' },
      { id: 'r2', entryId: 'n2', startedOn: '2026-11-01', endedOn: TODAY, outcome: 'finished' },
    ]
    const s = state({ statuses: ['finished', 'finished'], reads, goals: [{ year: 2026, targetBooks: 2 }] })
    expect(s.milestone).toMatchObject({ kind: 'goal', unit: 'books', target: 2, key: 'goal:2026:books' })
    expect(s.milestones.map((m) => m.kind)).toEqual(['goal', 'finished'])
  })

  it('cheers the day a pages goal is crossed', () => {
    const sessions = [session('r1', '2026-11-20', 150), session('r1', '2026-11-25', 60)]
    expect(state({ reads: [current], sessions, goals: [{ year: 2026, targetPages: 200 }] }).milestone).toMatchObject({ kind: 'goal', unit: 'pages', on: '2026-11-25' })
  })

  it('cheers a streak milestone reached recently', () => {
    const sessions = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', TODAY].map((d) => session('r1', d))
    expect(state({ reads: [current], sessions }).milestone).toMatchObject({ kind: 'streak', days: 7 })
    // Eight days in: the 7-day mark was yesterday, still fresh. Ten days in it isn't.
    const ten = ['2026-11-17', '2026-11-18', '2026-11-19', ...sessions.map((s) => s.startedAt.slice(0, 10))].map((d) => session('r1', d))
    expect(state({ reads: [current], sessions: ten }).mood).toBe('happy')
  })

  it('cheers a fresh achievement', () => {
    const unlocks: Unlock[] = [{ id: 'devoted:bronze', achievement: 'devoted', tier: 'bronze', unlockedOn: '2026-11-25', points: 10 }]
    expect(state({ reads: [current], sessions: [session('r1', '2026-11-25')], unlocks }).milestone).toMatchObject({ kind: 'achievement', achievement: 'devoted' })
  })
})
