import { useLiveQuery } from 'dexie-react-hooks'
import { FileUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { SETTING_PREFERRED_LANGUAGES } from '@/db/backup'
import { entriesWithoutGenre } from '@/db/genres'
import { placeImportedSeries, planGoodreadsImport, runGoodreadsImport, type ImportPlan, type ImportProgress, type ImportResult, type SeriesStepResult } from '@/db/goodreadsImport'
import { getSetting } from '@/db/queries'
import { today } from '@/db/clock'
import { DEFAULT_PREFERRED_LANGUAGES } from '@/domain/editions'
import { GoodreadsError, importCounts, parseGoodreadsCsv } from '@/domain/goodreads'
import { STATUSES } from '@/domain/types'
import { t } from '@/i18n'
import { BackLink } from '@/ui/books/BackLink'
import { ProgressBar } from '@/ui/books/ProgressBar'
import { setAchievementsQuiet } from '@/ui/achievements/quiet'
import { Button } from '@/ui/components/ui/button'
import { useOnline } from '@/ui/hooks/useDebounced'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

const g = t.goodreads

type Step =
  | { kind: 'pick'; error?: string }
  | { kind: 'preview'; plan: ImportPlan; skippedRows: number }
  | { kind: 'importing'; progress: ImportProgress }
  | { kind: 'series'; result: ImportResult; progress: { done: number; total: number } }
  | { kind: 'done'; result: ImportResult; series?: SeriesStepResult; stopped: boolean }

/** Requests Open Library makes per book, roughly (edition, authors, and a search when there is no ISBN). */
const REQUESTS_PER_BOOK = 3

/**
 * Profile → Import from Goodreads (design doc, Goodreads import): pick the
 * export, check the preview, import with progress, then series are looked
 * up for the new books.
 */
export function GoodreadsImportScreen() {
  const services = useServices()
  const { db, clock } = services
  const online = useOnline()
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [lookup, setLookup] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const withoutGenre = useLiveQuery(() => (step.kind === 'done' ? entriesWithoutGenre(db) : []), [db, step.kind])

  // Leaving the screen stops the import between two books.
  useEffect(
    () => () => {
      controller.current?.abort()
      setAchievementsQuiet(false)
    },
    [],
  )

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      const { books, skippedRows } = parseGoodreadsCsv(await file.text(), today(clock))
      setStep({ kind: 'preview', plan: await planGoodreadsImport(db, books), skippedRows: skippedRows.length })
    } catch (e) {
      setStep({ kind: 'pick', error: e instanceof GoodreadsError ? e.message : String(e) })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function start(plan: ImportPlan) {
    const abort = new AbortController()
    controller.current = abort
    setAchievementsQuiet(true)
    const useNetwork = lookup && online
    const preferredLanguages = await getSetting(db, SETTING_PREFERRED_LANGUAGES, DEFAULT_PREFERRED_LANGUAGES)
    setStep({ kind: 'importing', progress: { done: 0, total: plan.toImport.length } })
    const result = await runGoodreadsImport(
      { ...services, sources: useNetwork ? services.sources : undefined, preferredLanguages },
      plan.toImport,
      { signal: abort.signal, onProgress: (progress) => setStep({ kind: 'importing', progress }) },
    )
    if (abort.signal.aborted) {
      setAchievementsQuiet(false)
      setStep({ kind: 'done', result, stopped: true })
      return
    }
    setStep({ kind: 'series', result, progress: { done: 0, total: 0 } })
    let series: SeriesStepResult | undefined
    try {
      series = await placeImportedSeries({ db, series: services.series, detector: useNetwork ? services.seriesDetector : undefined }, result.imported, {
        signal: abort.signal,
        onProgress: (progress) => setStep({ kind: 'series', result, progress }),
      })
    } catch {
      // Skipped or failed: the Goodreads series labels still apply.
      series = await placeImportedSeries({ db, series: services.series }, result.imported).catch(() => undefined)
    }
    controller.current = null
    setAchievementsQuiet(false)
    setStep({ kind: 'done', result, series, stopped: false })
  }

  return (
    <>
      <BackLink />
      <ScreenHeader title={g.title} />
      {step.kind === 'pick' && (
        <div className="flex flex-col gap-4 surface p-4">
          <p className="text-sm">{g.intro}</p>
          <p className="text-sm text-muted-foreground">{g.howTo}</p>
          <div>
            <Button onClick={() => fileInput.current?.click()}>
              <FileUp />
              {g.choose}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="text/csv,.csv"
            className="sr-only"
            tabIndex={-1}
            aria-label={g.chooseLabel}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          {step.error && (
            <p role="alert" className="text-sm text-destructive">
              {step.error}
            </p>
          )}
        </div>
      )}

      {step.kind === 'preview' && (
        <Preview
          plan={step.plan}
          skippedRows={step.skippedRows}
          lookup={lookup && online}
          online={online}
          onLookup={setLookup}
          onStart={() => void start(step.plan)}
          onCancel={() => setStep({ kind: 'pick' })}
        />
      )}

      {step.kind === 'importing' && (
        <div className="flex flex-col gap-3 surface p-4" aria-live="polite">
          <p className="font-medium">{g.importing(step.progress.done, step.progress.total)}</p>
          <ProgressBar value={step.progress.total ? step.progress.done / step.progress.total : 0} label={g.importing(step.progress.done, step.progress.total)} />
          <p className="min-h-5 truncate text-sm text-muted-foreground">{step.progress.current && g.current(step.progress.current)}</p>
          <p className="text-xs text-muted-foreground">{g.keepOpen}</p>
          <div>
            <Button variant="outline" onClick={() => controller.current?.abort()}>
              {g.stop}
            </Button>
          </div>
        </div>
      )}

      {step.kind === 'series' && (
        <div className="flex flex-col gap-3 surface p-4" aria-live="polite">
          <p className="font-medium">{g.imported(step.result.imported.length)}</p>
          <p className="text-sm">{g.findingSeries(step.progress.done, step.progress.total)}</p>
          <ProgressBar value={step.progress.total ? step.progress.done / step.progress.total : 0} label={g.findingSeries(step.progress.done, step.progress.total)} />
          <div>
            <Button variant="outline" onClick={() => controller.current?.abort()}>
              {g.skipSeries}
            </Button>
          </div>
        </div>
      )}

      {step.kind === 'done' && (
        <div className="flex flex-col gap-4 surface p-4">
          <h2 className="text-lg font-semibold">{step.stopped ? g.stopped : g.done}</h2>
          <ul className="flex flex-col gap-1 text-sm" role="status">
            <li className="font-medium">{g.imported(step.result.imported.length)}</li>
            {step.result.matched > 0 && <li>{g.matched(step.result.matched)}</li>}
            {step.result.manual > 0 && <li>{g.manual(step.result.manual)}</li>}
            {step.result.existing > 0 && <li>{g.existing(step.result.existing)}</li>}
            {step.result.lookupFailed > 0 && <li>{g.lookupFailed(step.result.lookupFailed)}</li>}
            {step.series && step.series.detected + step.series.fromGoodreads > 0 && <li>{g.series(step.series.detected + step.series.fromGoodreads)}</li>}
          </ul>
          {step.result.failed.length > 0 && (
            <div className="text-sm">
              <p className="text-destructive">{g.failed(step.result.failed.length)}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {step.result.failed.map((f) => (
                  <li key={f.book.row}>
                    {f.book.title}: {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/library">{g.openLibrary}</Link>
            </Button>
            {(withoutGenre?.length ?? 0) > 0 && (
              <Button asChild variant="outline">
                <Link to="/genres/suggest">{g.suggestGenres}</Link>
              </Button>
            )}
            <Button variant="ghost" onClick={() => setStep({ kind: 'pick' })}>
              {g.another}
            </Button>
          </div>
          {(withoutGenre?.length ?? 0) > 0 && <p className="text-xs text-muted-foreground">{g.suggestGenresHint}</p>}
        </div>
      )}
    </>
  )
}

function Preview({
  plan,
  skippedRows,
  lookup,
  online,
  onLookup,
  onStart,
  onCancel,
}: {
  plan: ImportPlan
  skippedRows: number
  lookup: boolean
  online: boolean
  onLookup: (on: boolean) => void
  onStart: () => void
  onCancel: () => void
}) {
  const counts = importCounts(plan.toImport)
  const total = plan.toImport.length + plan.duplicates.length
  const minutes = Math.ceil((plan.toImport.length * REQUESTS_PER_BOOK) / 60)
  return (
    <div className="flex flex-col gap-4 surface p-4">
      <div>
        <h2 className="text-lg font-semibold">{g.preview}</h2>
        <p className="text-sm text-muted-foreground">{g.inFile(total)}</p>
      </div>
      {plan.toImport.length === 0 ? (
        <p className="text-sm">{g.nothing}</p>
      ) : (
        <>
          <p className="font-medium">{g.toImport(plan.toImport.length)}</p>
          <ul className="flex flex-wrap gap-2" aria-label={g.toImport(plan.toImport.length)}>
            {STATUSES.filter((s) => counts.byStatus[s] > 0).map((s) => (
              <li key={s} className="rounded-full border px-3 py-1 text-sm">
                {g.status(t.statusLong[s], counts.byStatus[s])}
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1 text-sm">
            <li>{g.finishedReads(counts.finishedReads, counts.rereads)}</li>
            <li>{g.rated(counts.rated)}</li>
            <li>{g.owned(counts.owned)}</li>
            {counts.reviews > 0 && <li>{g.reviews(counts.reviews)}</li>}
            {counts.lists.length > 0 && <li>{g.lists(counts.lists)}</li>}
          </ul>
          {counts.finishedReads > 0 && <p className="text-xs text-muted-foreground">{g.rereadsNote}</p>}
        </>
      )}
      {plan.duplicates.length > 0 && (
        <details className="rounded-md bg-muted p-3 text-sm">
          <summary className="cursor-pointer">{g.duplicates(plan.duplicates.length)}</summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {plan.duplicates.map((d) => (
              <li key={d.book.row}>
                {d.entryId ? <Link to={`/book/${d.entryId}`} className="underline">{d.book.title}</Link> : `${d.book.title} (${g.repeated})`}
              </li>
            ))}
          </ul>
        </details>
      )}
      {skippedRows > 0 && <p className="text-xs text-muted-foreground">{g.skippedRows(skippedRows)}</p>}
      {plan.toImport.length > 0 && (
        <>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--chart-1)]" checked={lookup} disabled={!online} onChange={(e) => onLookup(e.target.checked)} />
            <span>
              <span className="font-medium">{g.lookup}</span>
              <span className="block text-xs text-muted-foreground">{online ? g.lookupHint(minutes) : g.lookupOffline}</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onStart}>{g.start(plan.toImport.length)}</Button>
            <Button variant="ghost" onClick={onCancel}>
              {t.common.cancel}
            </Button>
          </div>
        </>
      )}
      {plan.toImport.length === 0 && (
        <div>
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        </div>
      )}
    </div>
  )
}
