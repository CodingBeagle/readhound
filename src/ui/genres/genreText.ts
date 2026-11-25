import type { GenreBook, ShownSuggestion } from '@/db/genres'
import type { BookView } from '@/domain/bookView'
import type { GenreSource } from '@/domain/genres'
import { t } from '@/i18n'

const gt = t.genres

/** Where suggestions came from, in words ("Open Library and Wikidata"). */
export function sourcesText(suggestions: readonly ShownSuggestion[]): string {
  const names = [...new Set(suggestions.flatMap((s) => s.sources).map((s: GenreSource) => gt.sources[s]))]
  return gt.from(names)
}

/** The book as genre suggestions and learning see it. */
export function genreBookOf(book: BookView): GenreBook {
  const work = book.work
  return {
    workId: work?.id,
    olWorkId: work?.sourceRef?.source === 'openlibrary' ? work.sourceRef.id : undefined,
    olEditionId: book.edition.sourceRef?.source === 'openlibrary' ? book.edition.sourceRef.id : undefined,
    titles: [...new Set([work?.title, book.edition.title].filter((x): x is string => !!x))],
    authors: book.authorNames,
    subjects: work?.subjects ?? [],
    firstPublishYear: work?.firstPublishYear,
  }
}
