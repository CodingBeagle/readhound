import { useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { useServices } from '@/app/services'
import type { CoverPhotoInput } from '@/db'
import type { EditionFormat } from '@/domain/types'
import { t } from '@/i18n'
import { languageFromIsbn, parseIsbn } from '@/sources/isbn'
import { BackLink } from '@/ui/books/BackLink'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select } from '@/ui/components/ui/input'
import { CoverPhotoPicker } from '@/ui/covers/CoverPhotoPicker'
import { celebrateNewBook } from '@/ui/motion/bookAddedBark'

const FORMATS = Object.keys(t.formats) as EditionFormat[]
const optionalNumber = (v: string) => (v.trim() ? Number(v) : undefined)
const optionalText = (v: string) => v.trim() || undefined

/** Manual entry, prefilled from the search query. Title and author are required. */
export function ManualEntryScreen() {
  const [params] = useSearchParams()
  const { library } = useServices()
  const navigate = useNavigate()
  const initialTitle = params.get('title') ?? ''
  // A query that is an ISBN prefills the ISBN field instead of the title.
  // A scanned ISBN the catalog doesn't know arrives as `isbn`.
  const queryIsbn = parseIsbn(params.get('isbn') ?? '') ?? parseIsbn(initialTitle)
  const notFound = params.has('notFound') && !!queryIsbn
  const [form, setForm] = useState({
    title: queryIsbn ? '' : initialTitle,
    subtitle: '',
    authors: params.get('author') ?? '',
    isbn: queryIsbn ?? '',
    pageCount: '',
    language: (queryIsbn && languageFromIsbn(queryIsbn)) ?? '',
    publisher: '',
    publishYear: '',
    format: '',
    coverUrl: '',
  })
  const [owned, setOwned] = useState(false)
  const [coverPhoto, setCoverPhoto] = useState<CoverPhotoInput>()
  const hintId = useId()
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const authors = form.authors.split(',').map((a) => a.trim()).filter(Boolean)
    const isbn = form.isbn.trim() ? parseIsbn(form.isbn) : null
    const next: typeof errors = {}
    if (!form.title.trim()) next.title = t.screens.manual.titleRequired
    if (authors.length === 0) next.authors = t.screens.manual.authorRequired
    if (form.isbn.trim() && !isbn) next.isbn = t.screens.manual.invalidIsbn
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const { entryId } = await library.addManual(
      {
        title: form.title,
        subtitle: optionalText(form.subtitle),
        authors,
        isbn13: isbn?.length === 13 ? isbn : undefined,
        isbn10: isbn?.length === 10 ? isbn : undefined,
        pageCount: optionalNumber(form.pageCount),
        language: optionalText(form.language.toLowerCase()),
        publisher: optionalText(form.publisher),
        publishYear: optionalNumber(form.publishYear),
        format: (form.format || undefined) as EditionFormat | undefined,
        coverUrl: optionalText(form.coverUrl),
        coverPhoto,
      },
      { owned },
    )
    celebrateNewBook()
    navigate(`/book/${entryId}`, { replace: true })
  }

  const m = t.screens.manual
  return (
    <>
      <BackLink />
      <h1 className="text-2xl title">{m.title}</h1>
      {notFound ? (
        <p role="status" className="surface mb-4 p-3 text-sm">
          {t.scan.notFound(queryIsbn!)}
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">{m.intro}</p>
      )}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={m.bookTitle} error={errors.title}>
          <Input value={form.title} onChange={set('title')} aria-invalid={Boolean(errors.title)} required />
        </Field>
        <Field label={m.authors} hint={m.authorsHint} error={errors.authors}>
          <Input value={form.authors} onChange={set('authors')} aria-invalid={Boolean(errors.authors)} required />
        </Field>
        <Field label={m.subtitle}>
          <Input value={form.subtitle} onChange={set('subtitle')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.isbn} error={errors.isbn}>
            <Input value={form.isbn} onChange={set('isbn')} inputMode="numeric" aria-invalid={Boolean(errors.isbn)} />
          </Field>
          <Field label={m.pageCount}>
            <Input type="number" min={1} value={form.pageCount} onChange={set('pageCount')} />
          </Field>
          <Field label={m.publisher}>
            <Input value={form.publisher} onChange={set('publisher')} />
          </Field>
          <Field label={m.publishYear}>
            <Input type="number" value={form.publishYear} onChange={set('publishYear')} />
          </Field>
          <Field label={m.language} hint={m.languageHint}>
            <Input value={form.language} onChange={set('language')} maxLength={3} />
          </Field>
          <Field label={m.format}>
            <Select value={form.format} onChange={set('format')}>
              <option value="" />
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t.formats[f]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1.5 font-medium">{t.covers.manualLabel}</legend>
          <div className="flex items-start gap-3">
            {coverPhoto && <img src={coverPhoto.dataUrl} alt={t.covers.manualPhoto} className="aspect-[2/3] w-16 rounded-md object-cover shadow" />}
            <CoverPhotoPicker onPhoto={setCoverPhoto} onRemove={coverPhoto ? () => setCoverPhoto(undefined) : undefined} />
          </div>
          {!coverPhoto && (
            <Field label={m.coverUrl}>
              <Input type="url" value={form.coverUrl} onChange={set('coverUrl')} />
            </Field>
          )}
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--chart-1)]" aria-label={t.owned.own} aria-describedby={hintId} checked={owned} onChange={(e) => setOwned(e.target.checked)} />
          <span>
            <span className="font-medium">{t.owned.own}</span>
            <span id={hintId} className="block text-xs text-muted-foreground">{t.owned.ownHint}</span>
          </span>
        </label>
        <Button type="submit" size="lg">
          {t.screens.add.submit}
        </Button>
      </form>
    </>
  )
}
