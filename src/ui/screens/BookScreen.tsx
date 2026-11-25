import { useLiveQuery } from 'dexie-react-hooks'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useServices } from '@/app/services'
import { loadBook } from '@/db/queries'
import type { BookView } from '@/domain/bookView'
import { localDate } from '@/domain/dates'
import { isBorrowed } from '@/domain/effective'
import { STATUSES, type EditableField, type Edition, type EditionFormat, type ReadingSession, type Status } from '@/domain/types'
import { t } from '@/i18n'
import { BackLink } from '@/ui/books/BackLink'
import { BookCover } from '@/ui/books/BookCover'
import { LogPageForm } from '@/ui/books/LogPageForm'
import { Notes } from '@/ui/books/Notes'
import { Organise } from '@/ui/books/Organise'
import { SessionForm } from '@/ui/books/SessionForm'
import { StatusBadge } from '@/ui/books/StatusBadge'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select } from '@/ui/components/ui/input'
import { EmptyState } from '@/ui/layout/EmptyState'
import { FinishCelebration } from '@/ui/motion/Celebration'
import { Section } from '@/ui/layout/Section'

const b = t.screens.book

export function BookScreen() {
  const { entryId = '' } = useParams()
  const { db } = useServices()
  const data = useLiveQuery(() => loadBook(db, entryId), [db, entryId])

  if (data === undefined) return null
  if (data === null)
    return (
      <>
        <BackLink />
        <EmptyState>{b.notFound}</EmptyState>
      </>
    )

  const { book, rawEdition, sessions } = data
  return (
    <>
      <BackLink />
      <FinishCelebration status={book.entry.status} />
      <header className="mb-5 flex gap-4">
        <BookCover url={book.edition.coverUrl} title={book.edition.title} className="animate-rise w-24 shadow-lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl leading-tight title">{book.edition.title}</h1>
          {book.edition.subtitle && <p className="text-sm">{book.edition.subtitle}</p>}
          <p className="text-muted-foreground">{book.authorNames.join(', ') || t.common.unknownAuthor}</p>
          <div>
            <StatusBadge status={book.entry.status} />
          </div>
        </div>
      </header>

      <Section title={b.statusLabel}>
        <StatusControl book={book} />
      </Section>

      {book.entry.status === 'reading' && (
        <Section title={t.common.pageOf(book.currentPage, book.edition.pageCount)}>
          <LogPageForm book={book} />
          <details className="mt-3">
            <summary className="cursor-pointer py-2 text-sm font-medium">{t.screens.log.addSession}</summary>
            <SessionForm book={book} />
          </details>
        </Section>
      )}

      <Section title={b.rating}>
        <RatingControl book={book} />
      </Section>

      <Section title={b.organise}>
        <Organise entryId={book.entry.id} categoryIds={book.entry.categoryIds} />
      </Section>

      <Section title={b.notes}>
        <Notes entryId={book.entry.id} pageCount={book.edition.pageCount} />
      </Section>

      <Section title={b.details}>
        <Details book={book} rawEdition={rawEdition} />
      </Section>

      <Section title={b.reads}>
        <ReadHistory book={book} sessions={sessions} />
      </Section>

      <DeleteBook entryId={book.entry.id} />
    </>
  )
}


function StatusControl({ book }: { book: BookView }) {
  const { library } = useServices()
  const [today] = useState(() => localDate(new Date()))
  const [pending, setPending] = useState<Status | null>(null)
  const [message, setMessage] = useState<string>()
  const [stoppedAt, setStoppedAt] = useState('')
  const [startedOn, setStartedOn] = useState(today)
  const [endedOn, setEndedOn] = useState(today)

  async function apply(to: Status, options = {}) {
    const result = await library.changeStatus(book.entry.id, to, options)
    setPending(null)
    setMessage(!result.ok && result.reason === 'has_sessions_mark_dnf' ? b.markDnfInstead : undefined)
  }

  function choose(to: Status) {
    setMessage(undefined)
    if (to === book.entry.status) return
    // DNF asks for the stop page; finishing without a read in progress asks for the dates.
    if (to === 'dnf' && book.openRead) {
      setStoppedAt(String(book.currentPage))
      return setPending('dnf')
    }
    if (to === 'finished' && !book.openRead) return setPending('finished')
    void apply(to)
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={b.statusLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <Button key={s} variant={book.entry.status === s ? 'default' : 'outline'} aria-pressed={book.entry.status === s} onClick={() => choose(s)}>
            {t.statusLong[s]}
          </Button>
        ))}
      </div>
      {pending === 'dnf' && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void apply('dnf', { stoppedAtPage: stoppedAt ? Number(stoppedAt) : undefined })
          }}
        >
          <Field label={b.stoppedAt} className="flex-1">
            <Input type="number" min={0} value={stoppedAt} onChange={(e) => setStoppedAt(e.target.value)} />
          </Field>
          <Button type="submit">{t.common.save}</Button>
        </form>
      )}
      {pending === 'finished' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void apply('finished', { startedOn, endedOn })
          }}
        >
          <p className="text-sm font-medium">{b.finishDates}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.screens.add.startedOn}>
              <Input type="date" value={startedOn} max={endedOn} onChange={(e) => setStartedOn(e.target.value)} />
            </Field>
            <Field label={t.screens.add.endedOn}>
              <Input type="date" value={endedOn} min={startedOn} onChange={(e) => setEndedOn(e.target.value)} />
            </Field>
          </div>
          <Button type="submit">{t.common.save}</Button>
        </form>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

const RATINGS = Array.from({ length: 10 }, (_, i) => (i + 1) / 2)

function RatingControl({ book }: { book: BookView }) {
  const { library } = useServices()
  return (
    <Select
      aria-label={b.rating}
      value={book.entry.rating ?? ''}
      onChange={(e) => library.setRating(book.entry.id, e.target.value ? Number(e.target.value) : undefined)}
      className="w-48"
    >
      <option value="">{b.noRating}</option>
      {RATINGS.map((r) => (
        <option key={r} value={r}>
          {'★'.repeat(Math.floor(r))}
          {r % 1 ? '½' : ''} ({r})
        </option>
      ))}
    </Select>
  )
}

const EDIT_FIELDS: { field: EditableField; label: string; type?: 'number' | 'url' }[] = [
  { field: 'title', label: t.screens.manual.bookTitle },
  { field: 'subtitle', label: t.screens.manual.subtitle },
  { field: 'pageCount', label: b.pages, type: 'number' },
  { field: 'publishYear', label: b.published, type: 'number' },
  { field: 'publisher', label: b.publisher },
  { field: 'language', label: b.language },
  { field: 'isbn13', label: 'ISBN-13' },
  { field: 'isbn10', label: 'ISBN-10' },
  { field: 'coverUrl', label: t.screens.manual.coverUrl, type: 'url' },
]

function Details({ book, rawEdition }: { book: BookView; rawEdition: Edition }) {
  const [editing, setEditing] = useState(false)
  const e = book.edition
  const rows: [string, React.ReactNode][] = [
    [b.pages, e.pageCount !== undefined ? <>{e.pageCount}{isBorrowed(rawEdition, 'pageCount') && <span className="block text-xs text-muted-foreground">{t.common.borrowed}</span>}</> : undefined],
    [b.published, [e.publisher, e.publishYear].filter(Boolean).join(', ') || undefined],
    [b.firstPublished, book.work?.firstPublishYear],
    [b.language, e.language],
    [b.format, e.format && t.formats[e.format]],
    [b.isbn, e.isbn13 ?? e.isbn10],
  ]
  const olUrl = rawEdition.sourceRef?.source === 'openlibrary' ? `https://openlibrary.org/books/${rawEdition.sourceRef.id}` : undefined

  if (editing) return <EditDetails rawEdition={rawEdition} onDone={() => setEditing(false)} />
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditing(true)}>
          {b.editDetails}
        </Button>
        {olUrl && (
          <Button asChild variant="ghost">
            <a href={olUrl} target="_blank" rel="noreferrer">
              {b.openLibrary}
              <ExternalLink />
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

function EditDetails({ rawEdition, onDone }: { rawEdition: Edition; onDone: () => void }) {
  const { library } = useServices()
  const shown = (f: EditableField) => String(rawEdition.overrides[f] ?? rawEdition[f] ?? '')
  const [values, setValues] = useState(() => Object.fromEntries([...EDIT_FIELDS.map(({ field }) => [field, shown(field)]), ['format', shown('format')]]) as Record<EditableField, string>)

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    const changes: Partial<Record<EditableField, unknown>> = {}
    for (const field of Object.keys(values) as EditableField[]) {
      const value = values[field].trim()
      if (value === shown(field)) continue
      const source = String(rawEdition[field] ?? '')
      // Back to the catalog value (or empty): drop the override.
      if (value === source || value === '') changes[field] = null
      else changes[field] = field === 'pageCount' || field === 'publishYear' ? Number(value) : value
    }
    await library.editEdition(rawEdition.id, changes)
    onDone()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{b.editHint}</p>
      {EDIT_FIELDS.map(({ field, label, type }) => (
        <Field key={field} label={label}>
          <Input type={type ?? 'text'} value={values[field]} onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))} />
        </Field>
      ))}
      <Field label={b.format}>
        <Select value={values.format} onChange={(e) => setValues((v) => ({ ...v, format: e.target.value }))}>
          <option value="" />
          {(Object.keys(t.formats) as EditionFormat[]).map((f) => (
            <option key={f} value={f}>
              {t.formats[f]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit">{t.common.save}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  )
}

function ReadHistory({ book, sessions }: { book: BookView; sessions: ReadingSession[] }) {
  const { library } = useServices()
  if (book.reads.length === 0) return <p className="text-sm text-muted-foreground">{b.noReads}</p>
  const reads = [...book.reads].sort((x, y) => y.startedOn.localeCompare(x.startedOn))
  return (
    <ol className="flex flex-col gap-4">
      {reads.map((read) => {
        const readSessions = sessions.filter((s) => s.readId === read.id).sort((x, y) => x.startedAt.localeCompare(y.startedAt))
        const label =
          read.outcome === 'finished'
            ? b.readFinished(read.startedOn, read.endedOn ?? '')
            : read.outcome === 'dnf'
              ? b.readDnf(read.startedOn, read.endedOn ?? '', read.stoppedAtPage)
              : b.readInProgress(read.startedOn)
        return (
          <li key={read.id} className="surface p-3">
            <p className="mb-2 text-sm font-medium">{label}</p>
            {readSessions.length > SESSIONS_SHOWN ? (
              <details>
                <summary className="cursor-pointer py-2 text-sm text-muted-foreground">{b.showSessions(readSessions.length)}</summary>
                <SessionList sessions={readSessions} onDelete={(id) => library.deleteSession(id)} />
              </details>
            ) : (
              <SessionList sessions={readSessions} onDelete={(id) => library.deleteSession(id)} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Reads with more sessions than this fold them away, so long reads don't swamp the page. */
const SESSIONS_SHOWN = 5

function SessionList({ sessions, onDelete }: { sessions: ReadingSession[]; onDelete: (id: string) => unknown }) {
  return (
    <ul className="flex flex-col gap-1">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            <span className="text-muted-foreground">{localDate(new Date(s.startedAt), s.timeZone)}</span>{' '}
            {b.sessionLine(s.fromPage, s.toPage, s.durationMinutes)}
          </span>
          <Button variant="ghost" size="icon" aria-label={b.deleteSession} onClick={() => onDelete(s.id)}>
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  )
}

function DeleteBook({ entryId }: { entryId: string }) {
  const { library } = useServices()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="mt-8 border-t pt-4">
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{b.confirmDelete}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={async () => {
                await library.deleteEntry(entryId)
                navigate('/library', { replace: true })
              }}
            >
              {t.common.delete}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2 />
          {b.deleteBook}
        </Button>
      )}
    </div>
  )
}
