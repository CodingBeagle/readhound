import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { scanLibraryForSeries, type ScanProgress } from '@/db'
import { t } from '@/i18n'
import { BackLink } from '@/ui/books/BackLink'
import { Button } from '@/ui/components/ui/button'
import { useOnline } from '@/ui/hooks/useDebounced'
import { useSeriesViews } from '@/ui/hooks/useSeries'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'
import { MemberCover, SeriesProgress } from '@/ui/series/SeriesBits'

const s = t.series
/** Covers shown per series card before "+n". */
const STRIP = 8

/** Library > Series: every series with its progress and covers in order. */
export function SeriesListScreen() {
  const views = useSeriesViews()
  return (
    <>
      <BackLink />
      <ScreenHeader title={s.title} />
      <ScanLibrary />
      {views?.length === 0 && <EmptyState>{s.empty}</EmptyState>}
      {views && views.length > 0 && (
        <ul className="stagger tint-cycle flex flex-col gap-3">
          {views.map((view) => (
            <li key={view.series.id} className="surface">
              <Link
                to={`/series/${view.series.id}`}
                className="flex flex-col gap-3 rounded-[inherit] p-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{view.series.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.owned(view.owned, view.total)}</span>
                </div>
                <div className="flex gap-1.5 overflow-hidden" aria-hidden>
                  {view.members.slice(0, STRIP).map((m) => (
                    <MemberCover key={m.member.id} member={m} className="w-10" />
                  ))}
                  {view.members.length > STRIP && (
                    <span className="flex w-10 shrink-0 items-center justify-center text-xs text-muted-foreground">+{view.members.length - STRIP}</span>
                  )}
                </div>
                <SeriesProgress view={view} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** "Find series for my library": looks up every book without a series. */
function ScanLibrary() {
  const { db, series, seriesDetector } = useServices()
  const online = useOnline()
  const [progress, setProgress] = useState<ScanProgress>()
  const [message, setMessage] = useState<string>()
  const running = progress !== undefined

  async function scan() {
    setMessage(undefined)
    setProgress({ done: 0, total: 0 })
    try {
      const result = await scanLibraryForSeries(db, series, seriesDetector, { onProgress: setProgress })
      setMessage(result.found === 0 && result.failed > 0 ? s.detectFailed : s.detected(result.found))
    } catch {
      setMessage(s.detectFailed)
    } finally {
      setProgress(undefined)
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-2">
      <div>
        <Button variant="outline" onClick={scan} disabled={running || !online}>
          <Search />
          {s.detect}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {running ? s.detecting(progress.done, progress.total) : (message ?? s.detectHint)}
      </p>
    </div>
  )
}
