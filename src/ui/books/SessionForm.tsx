import { useState } from 'react'

import { useServices } from '@/app/services'
import type { BookView } from '@/domain/bookView'
import { localDate } from '@/domain/dates'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { Field, Input } from '@/ui/components/ui/input'

const l = t.screens.log

/** Full session form for logging past reading: date, start time, duration and pages. */
export function SessionForm({ book }: { book: BookView }) {
  const { library } = useServices()
  const [form, setForm] = useState(() => {
    const now = new Date()
    return {
      date: localDate(now),
      time: now.toTimeString().slice(0, 5),
      fromPage: String(book.currentPage),
      toPage: '',
      minutes: '',
    }
  })
  const [error, setError] = useState<string>()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const result = await library.addSession(book.entry.id, {
      fromPage: Number(form.fromPage),
      toPage: Number(form.toPage),
      // Date and time are entered in the device's local time.
      startedAt: new Date(`${form.date}T${form.time}`).toISOString(),
      durationMinutes: form.minutes ? Number(form.minutes) : undefined,
    })
    if (!result.ok) return setError(result.error.message)
    setError(undefined)
    setForm((f) => ({ ...f, fromPage: f.toPage, toPage: '', minutes: '' }))
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 pt-2">
      <Field label={l.date}>
        <Input type="date" value={form.date} onChange={set('date')} required />
      </Field>
      <Field label={l.time}>
        <Input type="time" value={form.time} onChange={set('time')} required />
      </Field>
      <Field label={l.fromPage}>
        <Input type="number" min={0} value={form.fromPage} onChange={set('fromPage')} required />
      </Field>
      <Field label={l.toPage}>
        <Input type="number" min={1} value={form.toPage} onChange={set('toPage')} required />
      </Field>
      <Field label={l.minutes}>
        <Input type="number" min={1} value={form.minutes} onChange={set('minutes')} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" className="w-full">
          {t.common.save}
        </Button>
      </div>
      {error && (
        <p role="alert" className="col-span-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
