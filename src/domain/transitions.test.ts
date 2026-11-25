import { planTransition, type TransitionInput } from './transitions'
import type { Read, ReadingSession } from './types'

const today = '2026-11-25'
const openRead: Read = { id: 'r1', entryId: 'e1', startedOn: '2026-11-01' }
const session = (fromPage: number, toPage: number): ReadingSession => ({
  id: `s${toPage}`,
  readId: 'r1',
  startedAt: '2026-11-02T10:00:00.000Z',
  timeZone: 'Europe/Copenhagen',
  fromPage,
  toPage,
  pagesRead: toPage - fromPage,
})
const plan = (input: Partial<TransitionInput> & Pick<TransitionInput, 'from' | 'to'>) => planTransition({ today, ...input })

describe('status transitions (design doc table)', () => {
  it('(new) → to_read: no side effects', () => {
    expect(plan({ from: null, to: 'to_read' })).toEqual({ ok: true, status: 'to_read', changes: [] })
  })

  it('(new) → reading: creates a read started today', () => {
    expect(plan({ from: null, to: 'reading' })).toEqual({
      ok: true,
      status: 'reading',
      changes: [{ kind: 'createRead', read: { startedOn: today } }],
    })
  })

  it('(new) → finished: creates a finished read with the dates asked (default today)', () => {
    expect(plan({ from: null, to: 'finished' }).ok && plan({ from: null, to: 'finished' })).toMatchObject({
      changes: [{ kind: 'createRead', read: { startedOn: today, endedOn: today, outcome: 'finished' } }],
    })
    expect(plan({ from: null, to: 'finished', startedOn: '2026-01-01', endedOn: '2026-02-01' })).toMatchObject({
      changes: [{ kind: 'createRead', read: { startedOn: '2026-01-01', endedOn: '2026-02-01', outcome: 'finished' } }],
    })
  })

  it('to_read → reading: creates a read started today', () => {
    expect(plan({ from: 'to_read', to: 'reading' })).toMatchObject({
      changes: [{ kind: 'createRead', read: { startedOn: today } }],
    })
  })

  it('reading → finished: closes the read and tops up the last session to the page count', () => {
    expect(
      plan({ from: 'reading', to: 'finished', openRead, openReadSessions: [session(0, 120), session(120, 180)], pageCount: 300 }),
    ).toEqual({
      ok: true,
      status: 'finished',
      changes: [
        { kind: 'closeRead', readId: 'r1', patch: { endedOn: today, outcome: 'finished' } },
        { kind: 'addFinalSession', readId: 'r1', fromPage: 180, toPage: 300 },
      ],
    })
  })

  it('reading → finished: no top-up when already at the end or with no sessions', () => {
    const atEnd = plan({ from: 'reading', to: 'finished', openRead, openReadSessions: [session(0, 300)], pageCount: 300 })
    const noSessions = plan({ from: 'reading', to: 'finished', openRead, openReadSessions: [], pageCount: 300 })
    expect(atEnd.ok && atEnd.changes).toHaveLength(1)
    expect(noSessions.ok && noSessions.changes).toHaveLength(1)
  })

  it('reading → dnf: closes the read with the last session as stop page, editable by the user', () => {
    expect(plan({ from: 'reading', to: 'dnf', openRead, openReadSessions: [session(0, 85)] })).toMatchObject({
      changes: [{ kind: 'closeRead', readId: 'r1', patch: { outcome: 'dnf', stoppedAtPage: 85, endedOn: today } }],
    })
    expect(plan({ from: 'reading', to: 'dnf', openRead, openReadSessions: [session(0, 85)], stoppedAtPage: 90 })).toMatchObject({
      changes: [{ patch: { stoppedAtPage: 90 } }],
    })
  })

  it('reading → to_read: deletes the open read only if it has no sessions', () => {
    expect(plan({ from: 'reading', to: 'to_read', openRead, openReadSessions: [] })).toMatchObject({
      changes: [{ kind: 'deleteRead', readId: 'r1' }],
    })
    expect(plan({ from: 'reading', to: 'to_read', openRead, openReadSessions: [session(0, 10)] })).toEqual({
      ok: false,
      reason: 'has_sessions_mark_dnf',
    })
  })

  it('finished or dnf → reading: starts a new read (reread or retry)', () => {
    for (const from of ['finished', 'dnf'] as const) {
      expect(plan({ from, to: 'reading' })).toMatchObject({ changes: [{ kind: 'createRead', read: { startedOn: today } }] })
    }
  })

  it('finished or dnf → to_read: allowed, no read changes', () => {
    for (const from of ['finished', 'dnf'] as const) {
      expect(plan({ from, to: 'to_read' })).toEqual({ ok: true, status: 'to_read', changes: [] })
    }
  })

  it('never creates a second open read', () => {
    expect(plan({ from: 'to_read', to: 'reading', openRead })).toEqual({ ok: true, status: 'reading', changes: [] })
  })

  it('rejects a no-op change', () => {
    expect(plan({ from: 'reading', to: 'reading' })).toEqual({ ok: false, reason: 'no_change' })
  })
})
