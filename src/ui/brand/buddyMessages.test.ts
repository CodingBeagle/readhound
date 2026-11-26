import type { BuddyState } from '@/domain/buddy'

import { buddyMessage } from './buddyMessages'

const base: BuddyState = { mood: 'happy', streak: 0, empty: false, daysSinceReading: 0 }

describe('buddy messages', () => {
  it('names the milestone', () => {
    expect(buddyMessage({ ...base, mood: 'excited', milestone: { kind: 'finished', key: 'k', on: '2026-11-26', title: 'Dune' } }, 0, 0)).toContain('Dune')
    expect(buddyMessage({ ...base, mood: 'excited', milestone: { kind: 'goal', key: 'k', on: '2026-11-26', unit: 'pages', target: 10000 } }, 0, 0)).toContain('10,000 pages')
    expect(buddyMessage({ ...base, mood: 'excited', milestone: { kind: 'achievement', key: 'k', on: '2026-11-26', achievement: 'onARoll', tier: 'bronze' } }, 0, 0)).toContain('On a roll')
  })

  it('counts the days away when sleepy', () => {
    expect(buddyMessage({ ...base, mood: 'sleepy', daysSinceReading: 5 }, 0, 0)).toContain('5 days')
  })

  it('says something new on each tap', () => {
    const said = [0, 1, 2].map((pokes) => buddyMessage(base, 0, pokes))
    expect(new Set(said).size).toBe(3)
  })
})
