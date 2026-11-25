import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { applyGenres, entriesWithoutGenre, genreBookForEntry, recordGenreChoice, showSuggestions, suggestGenresFor } from '@/db/genres'
import type { BookView } from '@/domain/bookView'
import type { GenreId, GenreSuggestion } from '@/domain/genres'
import { t } from '@/i18n'
import { BackLink } from '@/ui/books/BackLink'
import { BookCover } from '@/ui/books/BookCover'
import { Button } from '@/ui/components/ui/button'
import { GenreSuggestionChips } from '@/ui/genres/GenreSuggestionChips'
import { useOnline } from '@/ui/hooks/useDebounced'
import { useLibrary } from '@/ui/hooks/useLibrary'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

const bf = t.genres.backfill

interface Row {
  suggestions?: GenreSuggestion[]
  /** Suggested genres the reader switched off; the rest are on. */
  off: ReadonlySet<GenreId>
  applied?: boolean
}

/**
 * "Suggest genres": every book without a genre, checked one at a time
 * (Open Library and Wikidata are asked politely), with the suggestions
 * ready to keep or drop (design doc, Genres).
 */
export function GenreBackfillScreen() {
  const { db, sources, genreLookup, collections } = useServices()
  const online = useOnline()
  const library = useLibrary()
  const categories = useLiveQuery(() => db.categories.toArray(), [db])
  // The books to go through are fixed when the screen opens, so applied ones stay in view with a tick.
  const [todo, setTodo] = useState<string[]>()
  const [rows, setRows] = useState<ReadonlyMap<string, Row>>(new Map())
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      const ids = await entriesWithoutGenre(db)
      setTodo(ids)
      for (const id of ids) {
        if (controller.signal.aborted) return
        const book = await genreBookForEntry(db, id)
        let suggestions: GenreSuggestion[] = []
        try {
          if (book) suggestions = await suggestGenresFor(db, book, online ? { sources, genreLookup } : undefined, controller.signal)
        } catch {
          if (controller.signal.aborted) return
        }
        setRows((prev) => new Map(prev).set(id, { suggestions, off: new Set() }))
      }
    })()
    return () => controller.abort()
    // Run once per database; going online later doesn't restart the check.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  const byId = new Map((library ?? []).map((b) => [b.entry.id, b]))
  const visible = (todo ?? []).filter((id) => byId.has(id) && !skipped.has(id))
  const checked = (todo ?? []).filter((id) => rows.has(id)).length
  const ready = visible.filter((id) => {
    const row = rows.get(id)
    return row && !row.applied && (row.suggestions ?? []).some((s) => !row.off.has(s.genre))
  })

  async function apply(id: string) {
    const row = rows.get(id)
    const book = await genreBookForEntry(db, id)
    if (!row?.suggestions || !book) return
    const chosen = row.suggestions.map((s) => s.genre).filter((g) => !row.off.has(g))
    await applyGenres(db, collections, id, chosen)
    await recordGenreChoice(db, book, row.suggestions.map((s) => s.genre), chosen)
    setRows((prev) => new Map(prev).set(id, { ...row, applied: true }))
  }

  return (
    <>
      <BackLink />
      <ScreenHeader title={bf.title} />
      <p className="-mt-3 mb-4 text-sm text-muted-foreground">{bf.intro}</p>
      {todo === undefined ? null : todo.length === 0 ? (
        <EmptyState>{bf.none}</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              {checked < todo.length ? bf.checking(checked, todo.length) : bf.done(todo.length)}
            </p>
            {ready.length > 1 && (
              <Button
                size="sm"
                onClick={async () => {
                  for (const id of ready) await apply(id)
                }}
              >
                {bf.applyAll(ready.length)}
              </Button>
            )}
          </div>
          <ul className="stagger flex flex-col gap-3">
            {visible.map((id) => (
              <BackfillRow
                key={id}
                book={byId.get(id)!}
                row={rows.get(id)}
                categories={categories ?? []}
                onToggle={(genre, on) => {
                  const row = rows.get(id)
                  if (!row) return
                  const off = new Set(row.off)
                  if (on) off.delete(genre)
                  else off.add(genre)
                  setRows(new Map(rows).set(id, { ...row, off }))
                }}
                onApply={() => void apply(id)}
                onSkip={() => setSkipped(new Set(skipped).add(id))}
              />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function BackfillRow(props: {
  book: BookView
  row: Row | undefined
  categories: Parameters<typeof showSuggestions>[1]
  onToggle: (genre: GenreId, on: boolean) => void
  onApply: () => void
  onSkip: () => void
}) {
  const { book, row, categories, onToggle, onApply, onSkip } = props
  const shown = row?.suggestions && showSuggestions(row.suggestions, categories)
  const selected = new Set((row?.suggestions ?? []).map((s) => s.genre).filter((g) => !row?.off.has(g)))
  return (
    <li className="surface flex gap-3 p-3">
      <Link to={`/book/${book.entry.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <BookCover url={book.edition.coverUrl} title={book.edition.title} className="w-12" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <Link to={`/book/${book.entry.id}`} className="card-title font-semibold hover:underline">
            {book.edition.title}
          </Link>
          <p className="text-sm text-muted-foreground">{book.authorNames.join(', ')}</p>
        </div>
        {row?.applied ? (
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Check aria-hidden className="size-4 text-primary" />
            {bf.applied}: {shown?.filter((s) => selected.has(s.genre)).map((s) => s.name).join(', ')}
          </p>
        ) : shown && shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{bf.noSuggestion}</p>
        ) : (
          <GenreSuggestionChips suggestions={shown} selected={selected} onToggle={onToggle} />
        )}
        {!row?.applied && shown && shown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onApply} disabled={selected.size === 0} aria-label={`${bf.apply}: ${book.edition.title}`}>
              {bf.apply}
            </Button>
            <Button size="sm" variant="ghost" onClick={onSkip}>
              {bf.skip}
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
