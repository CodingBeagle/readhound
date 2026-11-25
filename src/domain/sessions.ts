import type { ReadingSession } from './types'

export type SessionError =
  | { code: 'negative_from'; message: string }
  | { code: 'not_forward'; message: string }
  | { code: 'beyond_page_count'; message: string; pageCount: number }
  | { code: 'behind_previous'; message: string; previous: ReadingSession }

/**
 * Validation from "Logging progress": `0 ≤ fromPage < toPage ≤ pageCount`
 * (when the page count is known), and a session may not end before the
 * page the previous session reached; the user should edit that one instead.
 */
export function validateSession(
  session: Pick<ReadingSession, 'fromPage' | 'toPage'>,
  pageCount: number | undefined,
  previous?: ReadingSession,
): SessionError | null {
  if (previous && session.toPage < previous.toPage)
    return {
      code: 'behind_previous',
      message: `You were already on page ${previous.toPage}. Edit that session instead.`,
      previous,
    }
  if (session.fromPage < 0) return { code: 'negative_from', message: 'The start page cannot be negative.' }
  if (session.toPage <= session.fromPage)
    return { code: 'not_forward', message: 'The end page must be after the start page.' }
  if (pageCount !== undefined && session.toPage > pageCount)
    return { code: 'beyond_page_count', message: `This edition has ${pageCount} pages.`, pageCount }
  return null
}

/** The page reached so far: the furthest `toPage` of the read's sessions, or 0. */
export function currentPage(sessions: readonly ReadingSession[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.toPage), 0)
}

/** The session that reached the furthest page (latest by time on ties). */
export function lastSession(sessions: readonly ReadingSession[]): ReadingSession | undefined {
  return [...sessions].sort((a, b) => a.toPage - b.toPage || a.startedAt.localeCompare(b.startedAt)).at(-1)
}

/**
 * "I'm on page N" input, also accepting a percentage such as "45%",
 * converted with the effective page count. Returns null if it can't be read.
 */
export function parsePageInput(input: string, pageCount: number | undefined): number | null {
  const text = input.trim()
  const percent = text.match(/^(\d+(?:[.,]\d+)?)\s*%$/)
  if (percent) {
    if (!pageCount) return null
    const value = Number(percent[1]!.replace(',', '.'))
    if (value < 0 || value > 100) return null
    return Math.round((value / 100) * pageCount)
  }
  return /^\d+$/.test(text) ? Number(text) : null
}
