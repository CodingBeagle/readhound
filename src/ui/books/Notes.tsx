import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Quote, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { useServices } from '@/app/services'
import type { Note } from '@/domain/types'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select, Textarea } from '@/ui/components/ui/input'

const b = t.screens.book

/** Notes and quotes for a book, optionally tied to a page, sorted by page. */
export function Notes({ entryId, pageCount }: { entryId: string; pageCount?: number }) {
  const { db, collections } = useServices()
  const notes = useLiveQuery(
    async () =>
      (await db.notes.where('entryId').equals(entryId).toArray()).sort(
        (a, b) => (a.page ?? Infinity) - (b.page ?? Infinity) || a.createdAt.localeCompare(b.createdAt),
      ),
    [db, entryId],
  )
  const [editing, setEditing] = useState<string>()
  const [formKey, setFormKey] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      {notes?.length === 0 && <p className="text-sm text-muted-foreground">{b.noNotes}</p>}
      {notes && notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((note) =>
            editing === note.id ? (
              <li key={note.id} className="rounded-xl border p-3">
                <NoteForm
                  initial={note}
                  pageCount={pageCount}
                  submitLabel={t.common.save}
                  onCancel={() => setEditing(undefined)}
                  onSubmit={async (input) => {
                    await collections.updateNote(note.id, input)
                    setEditing(undefined)
                  }}
                />
              </li>
            ) : (
              <li key={note.id} className="flex gap-2 rounded-xl border p-3">
                {note.kind === 'quote' && <Quote aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className={note.kind === 'quote' ? 'text-sm whitespace-pre-wrap italic' : 'text-sm whitespace-pre-wrap'}>{note.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[b.noteKinds[note.kind], note.page !== undefined && b.notePageShort(note.page)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label={b.editNote} onClick={() => setEditing(note.id)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon" aria-label={b.deleteNote} onClick={() => void collections.deleteNote(note.id)}>
                  <Trash2 />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      <NoteForm
        key={formKey}
        pageCount={pageCount}
        submitLabel={b.addNote}
        onSubmit={async (input) => {
          await collections.addNote(entryId, input)
          setFormKey((k) => k + 1)
        }}
      />
    </div>
  )
}

interface NoteDraft {
  kind: Note['kind']
  text: string
  page?: number
}

function NoteForm({
  initial,
  pageCount,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: NoteDraft
  pageCount?: number
  submitLabel: string
  onSubmit: (input: NoteDraft) => Promise<void>
  onCancel?: () => void
}) {
  const [kind, setKind] = useState<Note['kind']>(initial?.kind ?? 'note')
  const [text, setText] = useState(initial?.text ?? '')
  const [page, setPage] = useState(initial?.page?.toString() ?? '')

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        void onSubmit({ kind, text, page: page ? Number(page) : undefined })
      }}
    >
      <Field label={b.noteText}>
        <Textarea value={text} rows={3} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <Field label={b.noteKind}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as Note['kind'])}>
            <option value="note">{b.noteKinds.note}</option>
            <option value="quote">{b.noteKinds.quote}</option>
          </Select>
        </Field>
        <Field label={b.notePage}>
          <Input inputMode="numeric" value={page} max={pageCount} onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Button type="submit" disabled={!text.trim()}>
          {submitLabel}
        </Button>
      </div>
      {onCancel && (
        <Button type="button" variant="ghost" className="self-start" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      )}
    </form>
  )
}
