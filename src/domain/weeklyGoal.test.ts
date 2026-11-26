import { bandFor, pageAfterReading, parseWeeklyGoal, weeklyProgress, weekStartOf } from './weeklyGoal'

const model = (entries: Record<string, number>) => ({ pagesByDate: new Map(Object.entries(entries)) })

describe('weekly pages goal', () => {
  it('starts weeks on Monday', () => {
    expect(weekStartOf('2026-11-26')).toBe('2026-11-23') // Thursday
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23') // Monday
    expect(weekStartOf('2026-11-29')).toBe('2026-11-23') // Sunday
    expect(weekStartOf('2026-11-30')).toBe('2026-11-30')
  })

  it('adds up only this week’s pages, up to today', () => {
    const week = weeklyProgress(model({ '2026-11-22': 500, '2026-11-23': 40, '2026-11-26': 35, '2026-11-27': 999 }), 200, '2026-11-26')
    expect(week).toMatchObject({ pages: 75, remaining: 125, from: '2026-11-23', to: '2026-11-29', daysLeft: 4, perDayNeeded: 32, band: 'going', intensity: 2 })
    expect(week.days.map((d) => d.pages)).toEqual([40, 0, 0, 35, 0, 0, 0])
    expect(week.reachedOn).toBeUndefined()
  })

  it('knows the day the goal was reached', () => {
    const week = weeklyProgress(model({ '2026-11-23': 60, '2026-11-24': 50, '2026-11-25': 10 }), 100, '2026-11-26')
    expect(week).toMatchObject({ pages: 120, remaining: 0, perDayNeeded: 0, reachedOn: '2026-11-24', band: 'done', intensity: 5 })
  })

  it('has bands that build up towards the goal', () => {
    expect([0, 0.1, 0.3, 0.6, 0.8, 0.95, 1, 1.6].map((s) => bandFor(s, s * 100))).toEqual(['none', 'started', 'going', 'halfway', 'close', 'almost', 'done', 'beyond'])
  })

  it('reads stored targets defensively', () => {
    expect(parseWeeklyGoal(250)).toBe(250)
    expect(parseWeeklyGoal('120')).toBe(120)
    expect(parseWeeklyGoal(0)).toBeUndefined()
    expect(parseWeeklyGoal('lots')).toBeUndefined()
    expect(parseWeeklyGoal(1e9)).toBe(10_000)
  })

  it('logs today’s pages from the current page, stopping at the last page', () => {
    expect(pageAfterReading(120, 30, 300)).toBe(150)
    expect(pageAfterReading(290, 30, 300)).toBe(300)
    expect(pageAfterReading(10, 5)).toBe(15)
  })
})
