import { useEffect, useRef } from 'react'

import { weekdayOf, type HeatDay } from '@/domain/stats'
import { t } from '@/i18n'

const CELL = 11
const GAP = 2
const s = t.screens.stats

/** Calendar grid of reading days: columns are weeks, rows Monday to Sunday. Scrolls sideways on phones, newest week in view. */
export function Heatmap({ days }: { days: HeatDay[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [days])
  if (days.length === 0) return null
  const offset = weekdayOf(days[0]!.date)
  const weeks = Math.ceil((days.length + offset) / 7)
  const width = weeks * (CELL + GAP)
  const height = 7 * (CELL + GAP)
  return (
    <div className="flex flex-col gap-2">
      <div ref={scroller} className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label={s.heatmap} className="block">
          {days.map((d, i) => {
            const index = i + offset
            return (
              <rect
                key={d.date}
                x={Math.floor(index / 7) * (CELL + GAP)}
                y={(index % 7) * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={`var(--heat-${d.level})`}
              >
                <title>{`${d.date}: ${d.pages} ${s.pages.toLowerCase()}`}</title>
              </rect>
            )
          })}
        </svg>
      </div>
      <div className="flex items-center gap-1 self-end text-xs text-muted-foreground">
        {s.heatmapLegendLess}
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} aria-hidden className="size-[11px] rounded-[2px]" style={{ background: `var(--heat-${l})` }} />
        ))}
        {s.heatmapLegendMore}
      </div>
    </div>
  )
}
