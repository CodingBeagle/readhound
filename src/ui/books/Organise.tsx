import { useMemo } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { applyGenres, categoryGenres, recordGenreChoice } from '@/db/genres'
import type { BookView } from '@/domain/bookView'
import { t } from '@/i18n'
import { ChipToggle } from '@/ui/components/ChipToggle'
import { genreBookOf } from '@/ui/genres/genreText'
import { GenreSuggestionChips } from '@/ui/genres/GenreSuggestionChips'
import { useGenreSuggestions } from '@/ui/genres/useGenreSuggestions'
import { useCollections } from '@/ui/hooks/useCollections'

const b = t.screens.book

/**
 * List and category chips for a book in the library; changes save at once.
 * A book with no genre gets suggested genres to tap, and switching a genre
 * on or off teaches the suggestions for similar books.
 */
export function Organise({ book }: { book: BookView }) {
  const { db, collections } = useServices()
  const data = useCollections()
  const entryId = book.entry.id
  const categoryIds = book.entry.categoryIds
  const genreOf = useMemo(() => categoryGenres(data?.categories ?? []), [data?.categories])
  const hasGenre = categoryIds.some((id) => data?.categories.some((c) => c.id === id && c.kind === 'genre'))
  const genreBook = useMemo(() => genreBookOf(book), [book])
  const suggestions = useGenreSuggestions(genreBook, !!data && !hasGenre)
  if (!data) return null
  const inList = new Set(data.listItems.filter((i) => i.entryId === entryId).map((i) => i.listId))
  return (
    <div className="flex flex-col gap-3">
      {!hasGenre && suggestions?.length !== 0 && (
        <GenreSuggestionChips suggestions={suggestions} selected={new Set()} label={t.genres.bookHint} onToggle={(genre) => void applyGenres(db, collections, entryId, [genre])} />
      )}
      <CollectionPicker
        lists={data.lists}
        categories={data.categories}
        listIds={inList}
        categoryIds={new Set(categoryIds)}
        onList={(id, on) => (on ? collections.addToList(id, entryId) : collections.removeFromList(id, entryId))}
        onCategory={async (id, on) => {
          await collections.toggleCategory(entryId, id, on)
          // A genre switched on was missing, one switched off was wrong: both are worth remembering.
          const genre = genreOf.get(id)
          if (genre) await recordGenreChoice(db, genreBook, on ? [] : [genre], on ? [genre] : [])
        }}
      />
    </div>
  )
}

/** The chips themselves, shared by the book screen and the add screen. */
export function CollectionPicker(props: {
  lists: readonly { id: string; name: string }[]
  categories: readonly { id: string; name: string }[]
  listIds: ReadonlySet<string>
  categoryIds: ReadonlySet<string>
  onList: (id: string, on: boolean) => unknown
  onCategory: (id: string, on: boolean) => unknown
  /** Hide the "manage in Profile" hint when there is nothing to pick. */
  quiet?: boolean
}) {
  const { lists, categories, listIds, categoryIds, onList, onCategory, quiet } = props
  if (lists.length === 0 && categories.length === 0)
    return quiet ? null : (
      <p className="text-sm text-muted-foreground">
        {b.noCollections}{' '}
        <Link to="/profile" className="font-medium text-foreground underline underline-offset-4">
          {b.manageCollections}
        </Link>
      </p>
    )
  return (
    <div className="flex flex-col gap-3">
      {lists.length > 0 && (
        <div role="group" aria-label={b.lists} className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-medium text-muted-foreground">{b.lists}</span>
          {lists.map((l) => (
            <ChipToggle key={l.id} pressed={listIds.has(l.id)} onClick={() => onList(l.id, !listIds.has(l.id))}>
              {l.name}
            </ChipToggle>
          ))}
        </div>
      )}
      {categories.length > 0 && (
        <div role="group" aria-label={b.categories} className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-medium text-muted-foreground">{b.categories}</span>
          {categories.map((c) => (
            <ChipToggle key={c.id} pressed={categoryIds.has(c.id)} onClick={() => onCategory(c.id, !categoryIds.has(c.id))}>
              {c.name}
            </ChipToggle>
          ))}
        </div>
      )}
    </div>
  )
}
