import type { GoalPace } from '@/domain/stats'
import { t } from '@/i18n'

import { formatNumber } from './format'

const s = t.screens.stats

/** Progress towards a yearly goal, with a marker where you should be today (design doc, Goal pace). */
export function GoalPaceBar({ pace, unit }: { pace: GoalPace; unit: 'books' | 'pages' }) {
  const share = Math.min(1, pace.actual / pace.target)
  const marker = Math.min(1, pace.expected / pace.target)
  const unitWord = unit === 'books' ? s.books.toLowerCase() : s.pages.toLowerCase()
  const status = pace.difference > 0 ? s.ahead(pace.difference, unitWord) : pace.difference < 0 ? s.behind(-pace.difference, unitWord) : s.onTrack
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-medium">
          {unit === 'books' ? s.goalBooks(pace.actual, pace.target) : s.goalPages(formatNumber(pace.actual), formatNumber(pace.target))}
        </span>
        <span className="text-muted-foreground">{status}</span>
      </div>
      <div
        className="relative h-2.5 rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={pace.target}
        aria-valuenow={pace.actual}
        aria-valuetext={status}
      >
        <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${share * 100}%` }} />
        <div title={s.paceMarker} className="absolute -top-1 h-[18px] w-0.5 rounded bg-foreground" style={{ left: `calc(${marker * 100}% - 1px)` }} />
      </div>
    </div>
  )
}
