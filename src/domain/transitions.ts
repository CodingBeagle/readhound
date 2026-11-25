/**
 * Status transitions from the design doc's "Status transitions" table, as a
 * pure planner: given the current state it returns the changes to make, and
 * the database layer applies them in one transaction.
 */
import { lastSession } from './sessions'
import type { Read, ReadingSession, Status } from './types'

export interface TransitionInput {
  /** Current status, or null for a book being added. */
  from: Status | null
  to: Status
  /** The entry's open read (no outcome yet), if any. At most one exists. */
  openRead?: Read
  /** Sessions of the open read. */
  openReadSessions?: readonly ReadingSession[]
  /** Effective page count of the edition, if known. */
  pageCount?: number
  /** Today's local date. */
  today: string
  /** For (new) → finished: dates asked from the user (default today). */
  startedOn?: string
  endedOn?: string
  /** For → dnf: the stop page if the user edited it. */
  stoppedAtPage?: number
}

export type ReadChange =
  | { kind: 'createRead'; read: Omit<Read, 'id' | 'entryId'> }
  | { kind: 'closeRead'; readId: string; patch: Pick<Read, 'outcome'> & Partial<Read> }
  | { kind: 'deleteRead'; readId: string }
  /** Tops up progress to the last page when a book is finished early. */
  | { kind: 'addFinalSession'; readId: string; fromPage: number; toPage: number }

export type TransitionPlan =
  | { ok: true; status: Status; changes: ReadChange[] }
  /** reading → to_read with logged sessions: the user should mark it DNF instead. */
  | { ok: false; reason: 'has_sessions_mark_dnf' }
  | { ok: false; reason: 'no_change' }

export function planTransition(input: TransitionInput): TransitionPlan {
  const { from, to, openRead, today } = input
  const sessions = input.openReadSessions ?? []
  if (from === to) return { ok: false, reason: 'no_change' }
  const plan = (changes: ReadChange[]): TransitionPlan => ({ ok: true, status: to, changes })

  // Finished without a logged reading (also to_read → finished): dates asked from the user.
  // A new reading attempt (from new, to_read, finished or dnf).
  if (to === 'reading') {
    return plan(openRead ? [] : [{ kind: 'createRead', read: { startedOn: today } }])
  }

  if ((from === null || from === 'to_read') && to === 'finished') {
    return plan([
      {
        kind: 'createRead',
        read: { startedOn: input.startedOn ?? today, endedOn: input.endedOn ?? today, outcome: 'finished' },
      },
    ])
  }

  if (from === 'reading' && openRead) {
    if (to === 'finished') {
      const changes: ReadChange[] = [
        { kind: 'closeRead', readId: openRead.id, patch: { endedOn: input.endedOn ?? today, outcome: 'finished' } },
      ]
      const reached = lastSession(sessions)?.toPage ?? 0
      if (input.pageCount !== undefined && sessions.length > 0 && reached < input.pageCount) {
        changes.push({ kind: 'addFinalSession', readId: openRead.id, fromPage: reached, toPage: input.pageCount })
      }
      return plan(changes)
    }
    if (to === 'dnf') {
      const stoppedAtPage = input.stoppedAtPage ?? lastSession(sessions)?.toPage
      return plan([
        { kind: 'closeRead', readId: openRead.id, patch: { endedOn: input.endedOn ?? today, outcome: 'dnf', stoppedAtPage } },
      ])
    }
    if (to === 'to_read') {
      if (sessions.length > 0) return { ok: false, reason: 'has_sessions_mark_dnf' }
      return plan([{ kind: 'deleteRead', readId: openRead.id }])
    }
  }

  // (new) → to_read, finished/dnf → to_read, and anything else: status only.
  return plan([])
}
