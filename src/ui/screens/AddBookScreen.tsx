import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { useServices } from '@/app/services'
import { localDate } from '@/domain/dates'
import type { Status } from '@/domain/types'
import { t } from '@/i18n'
import type { EditionDetails, SearchResult } from '@/sources/types'
import { BackLink } from '@/ui/books/BackLink'
import { BookCover } from '@/ui/books/BookCover'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select } from '@/ui/components/ui/input'

interface AddState {
  edition: EditionDetails
  work?: SearchResult
  fallbackCoverUrl?: string
}

/** Initial statuses offered when adding (the status table has no new → DNF). */
const INITIAL_STATUSES: Status[] = ['to_read', 'reading', 'finished']

/** Step 3 of adding a book: choose the initial status (default To read). */
export function AddBookScreen() {
  const state = useLocation().state as AddState | null
  const { library } = useServices()
  const navigate = useNavigate()
  const [today] = useState(() => localDate(new Date()))
  const [status, setStatus] = useState<Status>('to_read')
  const [startedOn, setStartedOn] = useState(today)
  const [endedOn, setEndedOn] = useState(today)
  const [busy, setBusy] = useState(false)

  if (!state?.edition) return <Navigate to="/search" replace />
  const { edition, work, fallbackCoverUrl } = state

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { entryId } = await library.addFromSource(
      {
        edition,
        work: work && { firstPublishYear: work.firstPublishYear, medianPageCount: work.medianPageCount },
        fallbackCoverUrl,
      },
      status === 'finished' ? { status, startedOn, endedOn } : { status },
    )
    navigate(`/book/${entryId}`, { replace: true })
  }

  return (
    <>
      <BackLink />
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{t.screens.add.title}</h1>
      <div className="mb-5 flex gap-4">
        <BookCover url={edition.coverUrl ?? fallbackCoverUrl} title={edition.title} className="w-20" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{edition.title}</span>
          <span className="text-sm text-muted-foreground">{edition.authors.map((a) => a.name).join(', ')}</span>
          <span className="text-xs text-muted-foreground">
            {[edition.publishers[0], edition.publishYear, (edition.pageCount ?? work?.medianPageCount) && t.common.pages((edition.pageCount ?? work?.medianPageCount)!)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t.screens.add.status}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {INITIAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.statusLong[s]}
              </option>
            ))}
          </Select>
        </Field>
        {status === 'finished' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.screens.add.startedOn}>
              <Input type="date" value={startedOn} max={endedOn} onChange={(e) => setStartedOn(e.target.value)} />
            </Field>
            <Field label={t.screens.add.endedOn}>
              <Input type="date" value={endedOn} min={startedOn} onChange={(e) => setEndedOn(e.target.value)} />
            </Field>
          </div>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {t.screens.add.submit}
        </Button>
      </form>
    </>
  )
}
