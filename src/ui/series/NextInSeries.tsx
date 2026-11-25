import { Layers } from 'lucide-react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { today as todayOf } from '@/db/clock'
import { addDays } from '@/domain/stats/calendar'
import { formatPosition, nextInSeries } from '@/domain/series'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/components/ui/button'
import { useSeriesViews } from '@/ui/hooks/useSeries'
import { Section } from '@/ui/layout/Section'

import { findLink } from './links'
import { MemberCover } from './SeriesBits'

const s = t.series
/** Series continued within this many days show up on Home. */
export const NEXT_IN_SERIES_DAYS = 120
const SHOWN = 3

/** Home: the next book in series you are reading through, with one tap to start, open or find it. */
export function NextInSeries({ className }: { className?: string }) {
  const { library, clock } = useServices()
  const views = useSeriesViews()
  if (!views) return null
  const next = nextInSeries(views, { since: addDays(todayOf(clock), -NEXT_IN_SERIES_DAYS), limit: SHOWN })
  if (next.length === 0) return null

  return (
    <div className={cn('animate-rise', className)}>
      <Section title={s.nextTitle}>
        <ul className="stagger flex flex-col gap-2">
          {next.map(({ series, next: m }) => (
            <li key={series.id} className="flex items-center gap-3 surface p-3">
              <MemberCover member={m} className="w-12" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link to={`/series/${series.id}`} className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline">
                  <Layers aria-hidden className="size-3.5 shrink-0" />
                  {s.nextLine(series.name, formatPosition(m.member.position))}
                </Link>
                <span className="truncate font-medium">{m.title}</span>
              </div>
              {m.book && m.book.entry.status === 'to_read' ? (
                <Button size="sm" onClick={() => void library.changeStatus(m.book!.entry.id, 'reading')} aria-label={`${s.startNext}: ${m.title}`}>
                  {s.startNext}
                </Button>
              ) : m.book ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/book/${m.book.entry.id}`}>{s.viewNext}</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link to={findLink(m)} aria-label={`${s.findNext}: ${m.title}`}>
                    {s.findNext}
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
