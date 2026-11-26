import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { useServices } from '@/app/services'
import type { CoverPhotoInput } from '@/db'
import { categoryForGenre, categoryGenres, recordGenreChoice, type GenreBook } from '@/db/genres'
import { normalizeFormat } from '@/db/library'
import { localDate } from '@/domain/dates'
import type { GenreId } from '@/domain/genres'
import type { EditionFormat, Status } from '@/domain/types'
import { t } from '@/i18n'
import type { EditionDetails, SearchResult } from '@/sources/types'
import { BackLink } from '@/ui/books/BackLink'
import { BookCover } from '@/ui/books/BookCover'
import { CollectionPicker } from '@/ui/books/Organise'
import { OwnedControl } from '@/ui/books/OwnedControl'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select } from '@/ui/components/ui/input'
import { CoverPhotoPicker } from '@/ui/covers/CoverPhotoPicker'
import { GenreSuggestionChips } from '@/ui/genres/GenreSuggestionChips'
import { useGenreSuggestions } from '@/ui/genres/useGenreSuggestions'
import { useCollections } from '@/ui/hooks/useCollections'
import { celebrateNewBook } from '@/ui/motion/bookAddedBark'

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
  const { library, db, collections: collectionsRepo } = useServices()
  const navigate = useNavigate()
  const [today] = useState(() => localDate(new Date()))
  const [status, setStatus] = useState<Status>('to_read')
  const [startedOn, setStartedOn] = useState(today)
  const [endedOn, setEndedOn] = useState(today)
  const [busy, setBusy] = useState(false)
  const [owned, setOwned] = useState(false)
  const [coverPhoto, setCoverPhoto] = useState<CoverPhotoInput>()
  const sourceFormat = state?.edition ? normalizeFormat(state.edition.format) : undefined
  const [format, setFormat] = useState<EditionFormat | undefined>(sourceFormat)
  const collections = useCollections()
  const [listIds, setListIds] = useState<ReadonlySet<string>>(new Set())
  const [categoryIds, setCategoryIds] = useState<ReadonlySet<string>>(new Set())
  /** Suggested genres the reader switched off (false) or back on (true); untouched suggestions are on. */
  const [overrides, setOverrides] = useState<ReadonlyMap<GenreId, boolean>>(new Map())

  const genreBook = useMemo((): GenreBook | undefined => {
    if (!state?.edition) return undefined
    const { edition, work } = state
    return {
      olWorkId: edition.work.source === 'openlibrary' ? edition.work.id : undefined,
      olEditionId: edition.edition.source === 'openlibrary' ? edition.edition.id : undefined,
      titles: [...new Set([work?.title, edition.title].filter((x): x is string => !!x))],
      authors: edition.authors.map((a) => a.name),
      subjects: [...new Set([...edition.subjects, ...(work?.subjects ?? [])])],
      firstPublishYear: work?.firstPublishYear ?? edition.publishYear,
    }
  }, [state])
  const suggestions = useGenreSuggestions(genreBook)

  if (!state?.edition || !genreBook) return <Navigate to="/search" replace />
  const { edition, work, fallbackCoverUrl } = state

  // Suggested genres are on unless switched off; those the reader already has a category for show as that category below too.
  const isOn = (genre: GenreId) => overrides.get(genre) ?? true
  const suggestedByCategory = new Map((suggestions ?? []).flatMap((s) => (s.categoryId ? [[s.categoryId, s.genre] as const] : [])))
  const chosenCategoryIds = new Set([...categoryIds].filter((id) => !suggestedByCategory.has(id)))
  for (const [id, genre] of suggestedByCategory) if (isOn(genre)) chosenCategoryIds.add(id)
  const selectedGenres = new Set((suggestions ?? []).filter((s) => isOn(s.genre)).map((s) => s.genre))
  const setGenre = (genre: GenreId, on: boolean) => setOverrides(new Map(overrides).set(genre, on))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    // New genre categories for chosen suggestions the reader has no category for yet.
    const finalCategoryIds = new Set(chosenCategoryIds)
    for (const s of suggestions ?? []) if (!s.categoryId && isOn(s.genre)) finalCategoryIds.add(await categoryForGenre(db, collectionsRepo, s.genre))
    if (suggestions) {
      const byCategory = categoryGenres(await db.categories.toArray())
      const chosen = [...finalCategoryIds].flatMap((id) => byCategory.get(id) ?? [])
      await recordGenreChoice(
        db,
        genreBook!,
        suggestions.map((s) => s.genre),
        chosen,
      )
    }
    const { entryId, existing } = await library.addFromSource(
      {
        edition,
        work: work && {
          firstPublishYear: work.firstPublishYear,
          medianPageCount: work.medianPageCount,
          ...(work.subjects?.length && { subjects: work.subjects }),
        },
        fallbackCoverUrl,
      },
      {
        status,
        ...(status === 'finished' && { startedOn, endedOn }),
        listIds: [...listIds],
        categoryIds: [...finalCategoryIds],
        owned,
      },
    )
    // My copy's format, when it differs from the catalog's, is kept as the reader's edit.
    if (owned && format !== sourceFormat) {
      const entry = await db.entries.get(entryId)
      if (entry) await library.editEdition(entry.editionId, { format: format ?? null })
    }
    if (coverPhoto && !existing) await library.setCoverPhoto(entryId, coverPhoto)
    if (!existing) celebrateNewBook()
    navigate(`/book/${entryId}`, { replace: true })
  }
  const sourceCover = edition.coverUrl ?? fallbackCoverUrl

  return (
    <>
      <BackLink />
      <h1 className="title mb-5 text-3xl">{t.screens.add.title}</h1>
      <div className="mb-5 flex gap-4">
        {coverPhoto ? (
          <img src={coverPhoto.dataUrl} alt={t.covers.manualPhoto} className="aspect-[2/3] w-20 shrink-0 rounded-md object-cover shadow" />
        ) : (
          <BookCover url={sourceCover} title={edition.title} className="w-20" />
        )}
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
      {/* No cover in the catalog: offer a photo of my copy (design doc, Cover photos). */}
      {!sourceCover && (
        <div className="mb-5 flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t.covers.hint}</p>
          <CoverPhotoPicker onPhoto={setCoverPhoto} onRemove={coverPhoto ? () => setCoverPhoto(undefined) : undefined} />
        </div>
      )}
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
        <OwnedControl owned={owned} format={format} onOwned={setOwned} onFormat={setFormat} />
        <GenreSuggestionChips suggestions={suggestions} selected={selectedGenres} onToggle={setGenre} />
        {collections && (
          <CollectionPicker
            quiet
            lists={collections.lists}
            categories={collections.categories}
            listIds={listIds}
            categoryIds={chosenCategoryIds}
            onList={(id, on) => setListIds(toggle(listIds, id, on))}
            onCategory={(id, on) => {
              const genre = suggestedByCategory.get(id)
              if (genre) setGenre(genre, on)
              else setCategoryIds(toggle(categoryIds, id, on))
            }}
          />
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {t.screens.add.submit}
        </Button>
      </form>
    </>
  )
}

function toggle(set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}
