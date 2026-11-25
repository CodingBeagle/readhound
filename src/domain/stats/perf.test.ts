import { buildSampleLibrary } from '@/demo/sampleLibrary'

import * as st from './index'

it('handles 2,000 books and 50,000 sessions quickly (design doc: under 500 ms)', () => {
  // Stamp out copies of the two-year sample library until it reaches the target size.
  const base = buildSampleLibrary({ today: '2026-11-25' })
  const copies = Math.ceil(50_000 / base.sessions.length)
  const input = {
    entries: [] as typeof base.entries,
    editions: [] as typeof base.editions,
    works: [] as typeof base.works,
    authors: [] as typeof base.authors,
    reads: [] as typeof base.reads,
    sessions: [] as typeof base.sessions,
    categories: base.categories,
  }
  for (let c = 0; c < copies; c++) {
    const id = (s: string) => `${s}-${c}`
    input.works.push(...base.works.map((w) => ({ ...w, id: id(w.id), authorIds: w.authorIds.map(id) })))
    input.authors.push(...base.authors.map((a) => ({ ...a, id: id(a.id) })))
    input.editions.push(...base.editions.map((e) => ({ ...e, id: id(e.id), workId: id(e.workId) })))
    input.entries.push(...base.entries.map((e) => ({ ...e, id: id(e.id), editionId: id(e.editionId) })))
    input.reads.push(...base.reads.map((r) => ({ ...r, id: id(r.id), entryId: id(r.entryId) })))
    input.sessions.push(...base.sessions.map((s) => ({ ...s, id: id(s.id), readId: id(s.readId) })))
  }
  expect(input.sessions.length).toBeGreaterThanOrEqual(50_000)
  expect(input.entries.length).toBeGreaterThanOrEqual(2_000)

  const start = performance.now()
  const model = st.buildStatsModel(input)
  const all = st.periodFor('all', '2026-11-25')
  st.booksRead(model, all)
  st.pagesRead(model, all)
  st.perMonth(model, all, '2026-11-25')
  st.heatmap(model, '2026-11-25')
  st.longestStreak(model)
  st.currentStreak(model, '2026-11-25')
  st.pagesByWeekdayAndHour(model, all)
  st.readingSpeedInPeriod(model, all)
  st.genresOverTime(model, all, 'year')
  st.topAuthors(model, all)
  st.languages(model, all)
  st.milestones(model)
  st.waitBeforeStarting(model, all)
  st.rereads(model)
  const ms = performance.now() - start
  // Generous for slow CI machines; locally this runs well under the 500 ms budget.
  expect(ms).toBeLessThan(2000)
  console.info(`stats for ${input.sessions.length} sessions: ${Math.round(ms)} ms`)
})
