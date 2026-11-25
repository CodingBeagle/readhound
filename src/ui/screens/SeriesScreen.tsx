import { Pencil, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useServices } from '@/app/services'
import { formatPosition, parsePosition, type SeriesMemberView, type SeriesView } from '@/domain/series'
import { t } from '@/i18n'
import { BackLink } from '@/ui/books/BackLink'
import { Button } from '@/ui/components/ui/button'
import { Field, Input } from '@/ui/components/ui/input'
import { useSeriesView } from '@/ui/hooks/useSeries'
import { EmptyState } from '@/ui/layout/EmptyState'
import { Section } from '@/ui/layout/Section'
import { MemberCover, MemberStateBadge, SeriesProgress } from '@/ui/series/SeriesBits'
import { findLink } from '@/ui/series/links'

const s = t.series

/** One series: its books in order, including the ones not in the library yet. */
export function SeriesScreen() {
  const { seriesId = '' } = useParams()
  const view = useSeriesView(seriesId)
  const [editing, setEditing] = useState(false)

  if (view === undefined) return null
  if (view === null)
    return (
      <>
        <BackLink />
        <EmptyState>{s.notFound}</EmptyState>
      </>
    )

  return (
    <>
      <BackLink />
      {editing ? (
        <EditSeries view={view} onDone={() => setEditing(false)} />
      ) : (
        <header className="mb-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h1 className="title text-2xl leading-tight">{view.series.name}</h1>
            <Button variant="ghost" size="icon" aria-label={s.rename} onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          </div>
          <SeriesProgress view={view} />
          <p className="text-sm text-muted-foreground">{s.owned(view.owned, view.total)}</p>
        </header>
      )}

      <ol className="stagger mb-6 flex flex-col gap-1">
        {view.members.map((m) => (
          <MemberRow key={m.member.id} member={m} isNext={view.next?.member.id === m.member.id} />
        ))}
      </ol>

      <Section title={s.addMissing}>
        <AddMissing seriesId={view.series.id} />
      </Section>

      <DeleteSeries seriesId={view.series.id} />
    </>
  )
}

function MemberRow({ member, isNext }: { member: SeriesMemberView; isNext: boolean }) {
  const { series } = useServices()
  const [editing, setEditing] = useState(false)
  const [position, setPosition] = useState(formatPosition(member.member.position) ?? '')
  const [error, setError] = useState<string>()
  const label = s.positionShort(formatPosition(member.member.position))

  const body = (
    <>
      <span className="w-9 shrink-0 text-right text-sm font-semibold text-muted-foreground tabular-nums">{label}</span>
      <MemberCover member={member} className="w-10" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium">{member.title}</span>
        <span className="flex flex-wrap items-center gap-2">
          <MemberStateBadge state={member.state} />
          {isNext && <span className="text-xs font-medium text-primary">{s.nextTitle}</span>}
        </span>
      </span>
    </>
  )

  if (editing)
    return (
      <li className="surface p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const pos = parsePosition(position)
            if (pos === null) return setError(s.invalidPosition)
            await series.updateMember(member.member.id, { position: pos ?? null })
            setEditing(false)
          }}
        >
          <Field label={`${s.position}: ${member.title}`} error={error} className="flex-1">
            <Input inputMode="decimal" value={position} onChange={(e) => setPosition(e.target.value)} />
          </Field>
          <Button type="submit">{t.common.save}</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            {t.common.cancel}
          </Button>
        </form>
      </li>
    )

  return (
    <li className="flex items-center gap-1">
      {member.book ? (
        <Link
          to={`/book/${member.book.entry.id}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 p-2">{body}</div>
      )}
      {!member.book && (
        <Button asChild variant="ghost" size="sm">
          <Link to={findLink(member)} aria-label={`${s.findMissing}: ${member.title}`}>
            <Search />
            {s.findMissing}
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="icon" aria-label={`${s.edit}: ${member.title}`} onClick={() => setEditing(true)}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`${s.remove}: ${member.title}`} onClick={() => void series.removeMember(member.member.id)}>
        <Trash2 />
      </Button>
    </li>
  )
}

function EditSeries({ view, onDone }: { view: SeriesView; onDone: () => void }) {
  const { series } = useServices()
  const [name, setName] = useState(view.series.name)
  const [total, setTotal] = useState(view.series.totalBooks?.toString() ?? '')
  const [error, setError] = useState<string>()
  return (
    <form
      className="mb-5 flex flex-col gap-3 surface p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return setError(s.nameNeeded)
        const n = total.trim() ? Number(total) : null
        if (n !== null && (!Number.isInteger(n) || n < 1)) return setError(s.invalidTotal)
        await series.updateSeries(view.series.id, { name, totalBooks: n })
        onDone()
      }}
    >
      <Field label={s.newName}>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={s.totalBooks} hint={s.totalHint} error={error}>
        <Input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} className="w-32" />
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

function AddMissing({ seriesId }: { seriesId: string }) {
  const { series } = useServices()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [position, setPosition] = useState('')
  const [error, setError] = useState<string>()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const pos = parsePosition(position)
        if (pos === null) return setError(s.invalidPosition)
        if (!title.trim()) return
        await series.addMissingMember(seriesId, { title, authorName: author, position: pos })
        setTitle('')
        setAuthor('')
        setPosition('')
        setError(undefined)
      }}
    >
      <Field label={s.missingTitle}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label={s.missingAuthor}>
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field label={s.position} error={error}>
          <Input inputMode="decimal" value={position} onChange={(e) => setPosition(e.target.value)} className="w-24" />
        </Field>
      </div>
      <div>
        <Button type="submit" variant="outline">
          {s.accept}
        </Button>
      </div>
    </form>
  )
}

function DeleteSeries({ seriesId }: { seriesId: string }) {
  const { series } = useServices()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="mt-8 border-t pt-4">
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{s.confirmDelete}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={async () => {
                await series.deleteSeries(seriesId)
                navigate('/series', { replace: true })
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
          {s.deleteSeries}
        </Button>
      )}
    </div>
  )
}
