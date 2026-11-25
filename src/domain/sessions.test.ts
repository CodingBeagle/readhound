import { localDate } from './dates'
import { effective, isBorrowed } from './effective'
import { currentPage, parsePageInput, validateSession } from './sessions'
import type { Edition, ReadingSession } from './types'

const prev: ReadingSession = {
  id: 's1',
  readId: 'r',
  startedAt: '2026-11-01T08:00:00Z',
  timeZone: 'UTC',
  fromPage: 0,
  toPage: 120,
  pagesRead: 120,
}

describe('session validation', () => {
  it('accepts 0 ≤ from < to ≤ pageCount', () => {
    expect(validateSession({ fromPage: 120, toPage: 180 }, 300, prev)).toBeNull()
    expect(validateSession({ fromPage: 0, toPage: 300 }, 300)).toBeNull()
    expect(validateSession({ fromPage: 0, toPage: 999 }, undefined)).toBeNull()
  })

  it('rejects bad ranges', () => {
    expect(validateSession({ fromPage: -1, toPage: 5 }, 300)?.code).toBe('negative_from')
    expect(validateSession({ fromPage: 50, toPage: 50 }, 300)?.code).toBe('not_forward')
    expect(validateSession({ fromPage: 0, toPage: 301 }, 300)?.code).toBe('beyond_page_count')
  })

  it('rejects going below the previous session, with a hint to edit it', () => {
    const error = validateSession({ fromPage: 0, toPage: 100 }, 300, prev)
    expect(error).toMatchObject({ code: 'behind_previous', previous: prev })
    expect(error?.message).toMatch(/Edit that session/)
  })

  it('finds the current page', () => {
    expect(currentPage([])).toBe(0)
    expect(currentPage([prev, { ...prev, fromPage: 120, toPage: 180 }])).toBe(180)
  })
})

describe('page input', () => {
  it('reads pages and percentages', () => {
    expect(parsePageInput('120', 300)).toBe(120)
    expect(parsePageInput('45%', 300)).toBe(135)
    expect(parsePageInput('12,5 %', 400)).toBe(50)
    expect(parsePageInput('45%', undefined)).toBeNull()
    expect(parsePageInput('abc', 300)).toBeNull()
    expect(parsePageInput('150%', 300)).toBeNull()
  })
})

describe('effective values', () => {
  const edition: Edition = {
    id: 'e',
    workId: 'w',
    title: 'Source title',
    pageCount: 435,
    borrowed: { pageCount: true },
    overrides: { title: 'My title' },
  }

  it('prefers overrides over source values', () => {
    expect(effective(edition, 'title')).toBe('My title')
    expect(effective(edition, 'pageCount')).toBe(435)
  })

  it('treats an overridden borrowed value as corrected', () => {
    expect(isBorrowed(edition, 'pageCount')).toBe(true)
    expect(isBorrowed({ ...edition, overrides: { pageCount: 440 } }, 'pageCount')).toBe(false)
  })
})

describe('local dates', () => {
  it('uses the given time zone', () => {
    const instant = new Date('2026-11-25T23:30:00Z')
    expect(localDate(instant, 'UTC')).toBe('2026-11-25')
    expect(localDate(instant, 'Europe/Copenhagen')).toBe('2026-11-26')
  })
})
