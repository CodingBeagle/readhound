import { buildBookView, type BookView } from './bookView'
import { buildSeriesViews, compareMembers, nextInSeries, parsePosition, parseSeriesLabel, preferredNextWorks, seriesKey } from './series'
import type { Series, SeriesMember, Status } from './types'

describe('parseSeriesLabel', () => {
  it.each([
    ['Harry Potter, #1', 'Harry Potter', 1],
    ['A Song of Ice and Fire #1', 'A Song of Ice and Fire', 1],
    ['Discworld -- 3', 'Discworld', 3],
    ['Millennium ; 1', 'Millennium', 1],
    ['(Afdeling Q ; bd. 2)', 'Afdeling Q', 2],
    ['Earthsea, book 2', 'Earthsea', 2],
    ['Wheel of Time vol. 4', 'Wheel of Time', 4],
    ['Discworld #3.5', 'Discworld', 3.5],
    ['Discworld 12', 'Discworld', 12],
  ])('%s', (raw, name, position) => {
    expect(parseSeriesLabel(raw)).toEqual({ name, position })
  })

  it('keeps labels without a number, and ignores years', () => {
    expect(parseSeriesLabel('Penguin Modern Classics')).toEqual({ name: 'Penguin Modern Classics' })
    expect(parseSeriesLabel('Penguin Classics 2003')).toEqual({ name: 'Penguin Classics 2003' })
    expect(parseSeriesLabel('  ')).toBeNull()
  })
})

describe('positions and names', () => {
  it('parses user input', () => {
    expect(parsePosition('3')).toBe(3)
    expect(parsePosition('3,5')).toBe(3.5)
    expect(parsePosition('')).toBeUndefined()
    expect(parsePosition('abc')).toBeNull()
    expect(parsePosition('-2')).toBeNull()
  })

  it('folds names for matching', () => {
    expect(seriesKey('The Expanse')).toBe(seriesKey('Expanse series'))
    expect(seriesKey('Millennium-trilogien')).toBe(seriesKey('Millennium'))
  })

  it('orders by position, then unnumbered by title', () => {
    const items = [{ title: 'B' }, { title: 'X', position: 2 }, { title: 'A' }, { title: 'Y', position: 1.5 }]
    expect([...items].sort(compareMembers).map((i) => i.title)).toEqual(['Y', 'X', 'A', 'B'])
  })
})

const series = (id: string, name: string, totalBooks?: number): Series => ({ id, name, totalBooks, origin: 'manual', createdAt: '2026-01-01T00:00:00Z' })
const member = (seriesId: string, title: string, position?: number, workId?: string): SeriesMember => ({
  id: `${seriesId}-${title}`,
  seriesId,
  title,
  position,
  workId,
  origin: 'manual',
  addedAt: '2026-01-01T00:00:00Z',
})
function book(workId: string, status: Status, finishedOn?: string): BookView {
  return buildBookView({
    entry: { id: `entry-${workId}`, editionId: `ed-${workId}`, status, addedAt: '', statusChangedAt: '', categoryIds: [], favourite: false },
    edition: { id: `ed-${workId}`, workId, title: workId.toUpperCase(), borrowed: {}, overrides: {} },
    work: undefined,
    authors: [],
    reads: finishedOn ? [{ id: `r-${workId}`, entryId: `entry-${workId}`, startedOn: finishedOn, endedOn: finishedOn, outcome: 'finished' }] : [],
    sessions: [],
  })
}

describe('series views', () => {
  it('counts progress and finds the next book after the furthest one read', () => {
    const [view] = buildSeriesViews(
      [series('q', 'Afdeling Q', 5)],
      [member('q', 'one', 1, 'w1'), member('q', 'two', 2, 'w2'), member('q', 'three', 3), member('q', 'four', 4, 'w4')],
      [book('w1', 'finished', '2026-02-01'), book('w2', 'finished', '2026-03-01'), book('w4', 'to_read')],
    )
    expect(view).toMatchObject({ total: 5, finished: 2, owned: 3, complete: false, lastFinishedOn: '2026-03-01' })
    expect(view!.next).toMatchObject({ title: 'three', state: 'missing' })
  })

  it('suggests nothing until a book is finished, or while the next one is being read', () => {
    const views = buildSeriesViews(
      [series('a', 'A'), series('b', 'B')],
      [member('a', 'a1', 1, 'a1'), member('a', 'a2', 2, 'a2'), member('b', 'b1', 1, 'b1'), member('b', 'b2', 2, 'b2')],
      [book('a1', 'to_read'), book('b1', 'finished', '2026-01-01'), book('b2', 'reading')],
    )
    expect(views.map((v) => v.next)).toEqual([undefined, undefined])
  })

  it('marks a series complete when every book is read, and counts a reread as read', () => {
    const [view] = buildSeriesViews(
      [series('t', 'Trilogien')],
      [member('t', 'Barndom', 1, 'w1'), member('t', 'Ungdom', 2, 'w2'), member('t', 'Gift', 3, 'w3')],
      [book('w1', 'finished', '2026-01-01'), book('w2', 'reading', '2026-02-01'), book('w3', 'finished', '2026-03-01')],
    )
    expect(view).toMatchObject({ complete: true, finished: 3, next: undefined })
  })

  it('lists next-in-series suggestions most recent first, for recommendations too', () => {
    const views = buildSeriesViews(
      [series('a', 'A'), series('b', 'B')],
      [member('a', 'a1', 1, 'a1'), member('a', 'a2', 2, 'a2'), member('b', 'b1', 1, 'b1'), { ...member('b', 'b2', 2), olWorkId: 'OL1W' }],
      [book('a1', 'finished', '2026-01-01'), book('a2', 'to_read'), book('b1', 'finished', '2026-05-01')],
    )
    expect(nextInSeries(views).map((v) => v.series.name)).toEqual(['B', 'A'])
    expect(nextInSeries(views, { since: '2026-03-01' }).map((v) => v.series.name)).toEqual(['B'])
    const preferred = preferredNextWorks(views)
    expect([...preferred.workIds]).toEqual(['a2'])
    expect([...preferred.olWorkIds]).toEqual(['OL1W'])
  })
})
