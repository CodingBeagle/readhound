import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'

import { useServices } from '@/app/services'
import { showSuggestions, suggestGenresFor, type GenreBook, type ShownSuggestion } from '@/db/genres'
import { useOnline } from '@/ui/hooks/useDebounced'

/**
 * Genre suggestions for a book, mapped onto the reader's categories. Asks
 * Open Library and Wikidata when online (both cached), and otherwise uses
 * what is known on the device. `undefined` while working.
 */
export function useGenreSuggestions(book: GenreBook | undefined, enabled = true): ShownSuggestion[] | undefined {
  const { db, sources, genreLookup } = useServices()
  const online = useOnline()
  const categories = useLiveQuery(() => db.categories.toArray(), [db])
  const key = book && (book.olWorkId ?? book.workId ?? `${book.titles[0]}|${book.authors[0]}`)
  const query = useQuery({
    queryKey: ['genre-suggestions', db.name, key, online],
    enabled: !!book && enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: ({ signal }) => suggestGenresFor(db, book!, online ? { sources, genreLookup } : undefined, signal),
  })
  return useMemo(() => (query.data && categories ? showSuggestions(query.data, categories) : undefined), [query.data, categories])
}
