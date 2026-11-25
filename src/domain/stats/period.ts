import { addDays, yearOf } from './calendar'

/** An inclusive date range. Open ends mean "from the beginning" or "up to today". */
export interface Period {
  from?: string
  to?: string
}

export type PeriodPreset = 'this_year' | 'last_year' | 'last_12_months' | 'all' | `year:${number}` | 'custom'

export function periodFor(preset: PeriodPreset, today: string, custom: Period = {}): Period {
  const year = yearOf(today)
  if (preset === 'this_year') return { from: `${year}-01-01`, to: `${year}-12-31` }
  if (preset === 'last_year') return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
  if (preset === 'last_12_months') return { from: addDays(today, -364), to: today }
  if (preset === 'all') return {}
  if (preset === 'custom') return custom
  const y = Number(preset.slice(5))
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

export function inPeriod(date: string | undefined, period: Period): boolean {
  if (!date) return false
  return (!period.from || date >= period.from) && (!period.to || date <= period.to)
}

/**
 * The period's actual first and last day for "per day" averages: an open start
 * becomes the first day with data, and the end never goes past today.
 */
export function boundedPeriod(period: Period, today: string, firstDataDate: string | undefined): { from: string; to: string } | null {
  const from = period.from ?? firstDataDate
  if (!from) return null
  const to = period.to && period.to < today ? period.to : today
  return from > to ? null : { from, to }
}
