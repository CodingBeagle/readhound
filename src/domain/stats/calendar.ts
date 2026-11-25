/** Date helpers for stats. Calendar dates are `YYYY-MM-DD` strings, compared as text. */

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

export const monthOf = (date: string) => date.slice(0, 7)
export const yearOf = (date: string) => Number(date.slice(0, 4))

/** Every month `YYYY-MM` from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = []
  let y = yearOf(from)
  let m = Number(from.slice(5, 7))
  const end = monthOf(to)
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (key > end) break
    months.push(key)
    m += 1
    if (m === 13) {
      m = 1
      y += 1
    }
  }
  return months
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/**
 * Local date and hour of an instant in a time zone. Formatters are cached per
 * zone because creating them is slow and a library can have 50,000 sessions.
 */
export function localParts(iso: string, timeZone: string): { date: string; hour: number } {
  let f = formatters.get(timeZone)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    } catch {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    }
    formatters.set(timeZone, f)
  }
  const parts: Record<string, string> = {}
  for (const p of f.formatToParts(new Date(iso))) parts[p.type] = p.value
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 }
}
