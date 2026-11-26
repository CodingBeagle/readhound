import type { WeeklyProgress } from '@/domain/weeklyGoal'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/ui/stats/format'

const w = t.screens.weekly

/**
 * The weekly goal bar (design doc, Weekly pages goal). It gets more intense
 * as the week fills up: richer colour first, then a shimmer, a glow, a pulse
 * with sparks at the tip, and a flowing rainbow once the goal is reached.
 * The look is driven by `data-intensity` in index.css; reduced motion keeps
 * the colours and glow but drops every moving part.
 */
export function WeeklyGoalBar({ week, className }: { week: WeeklyProgress; className?: string }) {
  const percent = Math.min(100, week.share * 100)
  return (
    <div
      className={cn('weekly-bar', className)}
      data-intensity={week.intensity}
      data-band={week.band}
      data-testid="weekly-bar"
      role="progressbar"
      aria-label={w.barLabel(formatNumber(week.pages), formatNumber(week.target))}
      aria-valuemin={0}
      aria-valuemax={week.target}
      aria-valuenow={Math.min(week.pages, week.target)}
    >
      <div className="weekly-track">
        {/* Keyed on the band so the fill bursts when it crosses into the next one. */}
        <div key={week.band} className="weekly-fill" style={{ width: `${percent}%` }} />
      </div>
      {week.intensity >= 4 && (
        <span aria-hidden className="weekly-tip" style={{ left: `${percent}%` }}>
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  )
}
