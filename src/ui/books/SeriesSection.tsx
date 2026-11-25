import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import type { BookView } from '@/domain/bookView'
import { formatPosition, parsePosition, type BookSeries } from '@/domain/series'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select } from '@/ui/components/ui/input'

const s = t.series
const NEW = '__new__'

/** The book's series with their numbers, editable in place, plus a form to add it to one. */
export function SeriesSection({ book, children }: { book: BookView; children?: React.ReactNode }) {
  const { series } = useServices()
  const [editing, setEditing] = useState<string>()
  const [adding, setAdding] = useState(false)
  const workId = book.edition.workId

  return (
    <div className="flex flex-col gap-3">
      {book.series.length === 0 && !adding && <p className="text-sm text-muted-foreground">{s.none}</p>}
      {book.series.length > 0 && (
        <ul className="flex flex-col gap-2">
          {book.series.map((bs) =>
            editing === bs.member.id ? (
              <li key={bs.member.id} className="surface p-3">
                <SeriesForm
                  initial={bs}
                  onCancel={() => setEditing(undefined)}
                  onSubmit={async ({ seriesId, position }) => {
                    if (seriesId === bs.series.id) await series.updateMember(bs.member.id, { position: position ?? null })
                    else {
                      await series.removeMember(bs.member.id)
                      await series.setWorkSeries(workId, seriesId, { position, origin: 'manual' })
                    }
                    setEditing(undefined)
                  }}
                />
              </li>
            ) : (
              <li key={bs.member.id} className="flex items-center gap-2 surface p-3">
                <Link to={`/series/${bs.series.id}`} className="min-w-0 flex-1 text-sm font-medium underline-offset-4 hover:underline">
                  {s.numbered(bs.series.name, formatPosition(bs.position))}
                </Link>
                <Button variant="ghost" size="icon" aria-label={`${s.edit} ${bs.series.name}`} onClick={() => setEditing(bs.member.id)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`${s.remove}: ${bs.series.name}`} onClick={() => void series.removeMember(bs.member.id)}>
                  <Trash2 />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      {children}
      {adding ? (
        <div className="surface p-3">
          <SeriesForm
            exclude={book.series.map((bs) => bs.series.id)}
            onCancel={() => setAdding(false)}
            onSubmit={async ({ seriesId, position }) => {
              await series.setWorkSeries(workId, seriesId, { position, origin: 'manual' })
              setAdding(false)
            }}
          />
        </div>
      ) : (
        <div>
          <Button variant="outline" onClick={() => setAdding(true)}>
            {book.series.length ? s.addAnother : s.add}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Pick an existing series (or name a new one) and the book's number in it. */
function SeriesForm({
  initial,
  exclude = [],
  onSubmit,
  onCancel,
}: {
  initial?: BookSeries
  exclude?: readonly string[]
  onSubmit: (value: { seriesId: string; position?: number }) => Promise<void>
  onCancel: () => void
}) {
  const { db, series } = useServices()
  const all = useLiveQuery(async () => (await db.series.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' })), [db])
  const options = all?.filter((x) => x.id === initial?.series.id || !exclude.includes(x.id))
  const [choice, setChoice] = useState(initial?.series.id ?? '')
  const [name, setName] = useState('')
  const [position, setPosition] = useState(formatPosition(initial?.position) ?? '')
  const [error, setError] = useState<string>()
  if (!options) return null
  const picked = choice || (options.length === 0 ? NEW : '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const pos = parsePosition(position)
    if (pos === null) return setError(s.invalidPosition)
    if (!picked || (picked === NEW && !name.trim())) return setError(s.nameNeeded)
    const seriesId = picked === NEW ? await series.createSeries({ name }) : picked
    await onSubmit({ seriesId, position: pos })
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      {options.length > 0 && (
        <Field label={s.which}>
          <Select value={picked} onChange={(e) => setChoice(e.target.value)}>
            <option value="" disabled />
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
            <option value={NEW}>{s.newSeries}</option>
          </Select>
        </Field>
      )}
      {picked === NEW && (
        <Field label={s.newName}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus={options.length > 0} />
        </Field>
      )}
      <Field label={s.position} hint={s.positionHint} error={error}>
        <Input inputMode="decimal" value={position} onChange={(e) => setPosition(e.target.value)} className="w-32" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit">{t.common.save}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  )
}
