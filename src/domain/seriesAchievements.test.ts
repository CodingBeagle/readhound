import { achievements } from './achievements'
import { buildStatsModel } from './stats'
import type { Edition, LibraryEntry, Read, Series, SeriesMember, Work } from './types'

/** Four books: a trilogy read in order (1, 2, 3) and one book outside it. */
const works: Work[] = ['w1', 'w2', 'w3', 'w4'].map((id) => ({ id, title: id, authorIds: [], subjects: [] }))
const editions: Edition[] = works.map((w) => ({ id: `e-${w.id}`, workId: w.id, title: w.title, pageCount: 200, borrowed: {}, overrides: {} }))
const entries: LibraryEntry[] = works.map((w) => ({
  id: `n-${w.id}`,
  editionId: `e-${w.id}`,
  status: 'finished',
  addedAt: '2026-01-01T00:00:00Z',
  statusChangedAt: '2026-01-01T00:00:00Z',
  categoryIds: [],
  favourite: false,
}))
const read = (workId: string, endedOn: string): Read => ({ id: `r-${workId}`, entryId: `n-${workId}`, startedOn: endedOn, endedOn, outcome: 'finished' })
// Order of finishing: w1, w4 (outside the series), w2, w3.
const reads = [read('w1', '2026-01-10'), read('w4', '2026-02-10'), read('w2', '2026-03-10'), read('w3', '2026-04-10')]
const model = buildStatsModel({ entries, editions, works, authors: [], reads, sessions: [], categories: [] })

const trilogy: Series = { id: 's', name: 'Trilogien', origin: 'manual', createdAt: '' }
const member = (workId: string | undefined, position: number): SeriesMember => ({
  id: `m${position}`,
  seriesId: 's',
  workId,
  title: `Book ${position}`,
  position,
  origin: 'manual',
  addedAt: '',
})

const get = (members: SeriesMember[], series: Series[] = [trilogy]) => {
  const summary = achievements({ model, goals: [], series: { series, members } })
  return {
    completionist: summary.families.find((f) => f.id === 'completionist')!,
    trilogy: summary.specials.find((s) => s.id === 'trilogy')!,
    backToBack: summary.specials.find((s) => s.id === 'backToBack')!,
  }
}

describe('series achievements', () => {
  it('completes a series on the day its last book is finished', () => {
    const a = get([member('w1', 1), member('w2', 2), member('w3', 3)])
    expect(a.completionist).toMatchObject({ value: 1, tier: 'bronze' })
    expect(a.completionist.tiers[0]!.unlockedOn).toBe('2026-04-10')
    expect(a.trilogy).toMatchObject({ unlocked: true, unlockedOn: '2026-04-10' })
    // w2 then w3 were finished one after the other; w1 → w2 had w4 in between.
    expect(a.backToBack).toMatchObject({ unlocked: true, unlockedOn: '2026-04-10' })
  })

  it('needs every known book, and the stated total, to be read', () => {
    expect(get([member('w1', 1), member('w2', 2), member(undefined, 3)]).completionist.value).toBe(0)
    expect(get([member('w1', 1), member('w2', 2), member('w3', 3)], [{ ...trilogy, totalBooks: 4 }]).completionist.value).toBe(0)
  })

  it('counts a two-book series as complete but not as a trilogy', () => {
    const a = get([member('w2', 1), member('w3', 2)])
    expect(a.completionist.value).toBe(1)
    expect(a.trilogy.unlocked).toBe(false)
  })

  it('works without series data', () => {
    const summary = achievements({ model, goals: [] })
    expect(summary.families.find((f) => f.id === 'completionist')!.value).toBe(0)
    expect(summary.specials.find((s) => s.id === 'backToBack')!.unlocked).toBe(false)
  })
})
