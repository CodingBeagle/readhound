/**
 * Gathers the evidence for genre suggestions and applies the reader's
 * choices (design doc, Genres). The scoring itself is in `domain/genres.ts`.
 */
import { effectiveAuthorName, effectiveEdition } from '@/domain/effective'
import {
  GENRE_BY_ID,
  genreForCategory,
  learnFromChoice,
  learningTerms,
  suggestGenres,
  type GenreEvidence,
  type GenreId,
  type GenreLearning,
  type GenreSuggestion,
} from '@/domain/genres'
import { normalizeTerm } from '@/domain/recommendations'
import type { Category } from '@/domain/types'
import type { SourceRegistry, WikidataGenreLookup } from '@/sources'

import type { CollectionsRepository } from './collections'
import { getSetting } from './queries'
import type { ReadhoundDB } from './schema'

/** What the reader taught the app by correcting genres (see `GenreLearning`). Part of the backup like every setting. */
export const SETTING_GENRE_LEARNING = 'genreLearning'

/** A book to suggest genres for: one in the library, or one about to be added. */
export interface GenreBook {
  /** The library work, when the book is already in the library. */
  workId?: string
  olWorkId?: string
  olEditionId?: string
  titles: string[]
  authors: string[]
  /** Subjects known without asking the network (the stored work, or the edition being added). */
  subjects: string[]
  firstPublishYear?: number
}

export interface GenreNetwork {
  sources: SourceRegistry
  genreLookup: WikidataGenreLookup
}

/** Category id → the genre it stands for, for the reader's genre categories. */
export function categoryGenres(categories: readonly Category[]): Map<string, GenreId> {
  const map = new Map<string, GenreId>()
  for (const c of categories) {
    if (c.kind !== 'genre') continue
    const genre = genreForCategory(c.name)
    if (genre) map.set(c.id, genre)
  }
  return map
}

/** Genres of each library work, from its entries' genre categories. */
async function genresByWork(db: ReadhoundDB): Promise<Map<string, Set<GenreId>>> {
  const [entries, editions, categories] = await Promise.all([db.entries.toArray(), db.editions.toArray(), db.categories.toArray()])
  const byCategory = categoryGenres(categories)
  const workOf = new Map(editions.map((e) => [e.id, e.workId]))
  const result = new Map<string, Set<GenreId>>()
  for (const entry of entries) {
    const workId = workOf.get(entry.editionId)
    if (!workId) continue
    for (const id of entry.categoryIds) {
      const genre = byCategory.get(id)
      if (!genre) continue
      const set = result.get(workId) ?? new Set<GenreId>()
      set.add(genre)
      result.set(workId, set)
    }
  }
  return result
}

/** Evidence that needs no network: the known subjects, series and author fallbacks, and what the reader taught. */
export async function localGenreEvidence(db: ReadhoundDB, book: GenreBook): Promise<GenreEvidence> {
  const [byWork, works, authors, learned] = await Promise.all([
    genresByWork(db),
    db.works.toArray(),
    db.authors.toArray(),
    getSetting<GenreLearning>(db, SETTING_GENRE_LEARNING, {}),
  ])

  // Series: other books in the same series, found by the library work or, for a book not yet added, its Open Library work.
  const ownMembers = [
    ...(book.workId ? await db.seriesMembers.where('workId').equals(book.workId).toArray() : []),
    ...(book.olWorkId ? await db.seriesMembers.where('olWorkId').equals(book.olWorkId).toArray() : []),
  ]
  const seriesGenres: GenreId[] = []
  for (const seriesId of new Set(ownMembers.map((m) => m.seriesId))) {
    const members = await db.seriesMembers.where('seriesId').equals(seriesId).toArray()
    for (const m of members) if (m.workId && m.workId !== book.workId) seriesGenres.push(...(byWork.get(m.workId) ?? []))
  }

  // Author: the author's other books that have genres.
  const names = new Set(book.authors.map(normalizeTerm).filter(Boolean))
  const authorIds = new Set(authors.filter((a) => names.has(normalizeTerm(effectiveAuthorName(a)))).map((a) => a.id))
  const authorGenres = works
    .filter((w) => w.id !== book.workId && !(book.olWorkId && w.sourceRef?.id === book.olWorkId) && w.authorIds.some((id) => authorIds.has(id)))
    .flatMap((w) => {
      const genres = byWork.get(w.id)
      return genres?.size ? [[...genres]] : []
    })

  return {
    workSubjects: book.subjects,
    seriesGenres,
    authorGenres,
    terms: learningTerms(book.subjects, book.authors),
    learned,
    firstPublishYear: book.firstPublishYear,
  }
}

/** Adds the network evidence: subjects of every edition (Open Library) and the work's genres on Wikidata. Failures are skipped. */
export async function networkGenreEvidence(network: GenreNetwork, book: GenreBook, signal?: AbortSignal): Promise<Pick<GenreEvidence, 'editionSubjects' | 'wikidataGenres'>> {
  const result: Pick<GenreEvidence, 'editionSubjects' | 'wikidataGenres'> = {}
  if (book.olWorkId) {
    try {
      const editions = (await network.sources.get('openlibrary')?.listEditions({ source: 'openlibrary', id: book.olWorkId }, { limit: 50 })) ?? []
      result.editionSubjects = editions.map((e) => e.subjects).filter((s) => s.length > 0)
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  try {
    result.wikidataGenres = await network.genreLookup.genresFor(
      {
        olids: [book.olWorkId, book.olEditionId].filter((x): x is string => !!x),
        titles: book.titles,
        authors: book.authors,
      },
      signal,
    )
  } catch (error) {
    if (signal?.aborted) throw error
  }
  return result
}

/** Suggestions for the book; with `network`, also asks Open Library and Wikidata. */
export async function suggestGenresFor(db: ReadhoundDB, book: GenreBook, network?: GenreNetwork, signal?: AbortSignal): Promise<GenreSuggestion[]> {
  const local = await localGenreEvidence(db, book)
  const remote = network ? await networkGenreEvidence(network, book, signal) : {}
  return suggestGenres({ ...local, ...remote })
}

/** The book behind a library entry, for suggestions and learning. */
export async function genreBookForEntry(db: ReadhoundDB, entryId: string): Promise<GenreBook | undefined> {
  const entry = await db.entries.get(entryId)
  const edition = entry && (await db.editions.get(entry.editionId))
  const work = edition && (await db.works.get(edition.workId))
  if (!edition || !work) return undefined
  const authors = (await db.authors.bulkGet(work.authorIds)).flatMap((a) => (a ? [effectiveAuthorName(a)] : []))
  return {
    workId: work.id,
    olWorkId: work.sourceRef?.source === 'openlibrary' ? work.sourceRef.id : undefined,
    olEditionId: edition.sourceRef?.source === 'openlibrary' ? edition.sourceRef.id : undefined,
    titles: [...new Set([work.title, effectiveEdition(edition).title])],
    authors,
    subjects: work.subjects,
    firstPublishYear: work.firstPublishYear,
  }
}

/** A suggestion as shown to the reader: the category it would set, or the new one it would create. */
export interface ShownSuggestion extends GenreSuggestion {
  /** The reader's existing category for this genre, if any. */
  categoryId?: string
  name: string
}

export function showSuggestions(suggestions: readonly GenreSuggestion[], categories: readonly Category[]): ShownSuggestion[] {
  const byGenre = new Map<GenreId, Category>()
  for (const c of categories) {
    if (c.kind !== 'genre') continue
    const genre = genreForCategory(c.name)
    if (genre && !byGenre.has(genre)) byGenre.set(genre, c)
  }
  return suggestions.map((s) => {
    const category = byGenre.get(s.genre)
    return {
      ...s,
      categoryId: category?.id,
      name: category?.name ?? GENRE_BY_ID.get(s.genre)!.name,
    }
  })
}

/** The category id for a genre: the reader's own, or a new genre category created now. */
export async function categoryForGenre(db: ReadhoundDB, collections: CollectionsRepository, genre: GenreId): Promise<string> {
  const existing = (await db.categories.toArray()).find((c) => c.kind === 'genre' && genreForCategory(c.name) === genre)
  if (existing) return existing.id
  const g = GENRE_BY_ID.get(genre)!
  return collections.createCategory({
    name: g.name,
    kind: 'genre',
    isFiction: g.isFiction,
  })
}

/** Puts the genres on the entry, creating categories the reader doesn't have yet. */
export async function applyGenres(db: ReadhoundDB, collections: CollectionsRepository, entryId: string, genres: Iterable<GenreId>): Promise<void> {
  for (const genre of genres) await collections.toggleCategory(entryId, await categoryForGenre(db, collections, genre), true)
}

/** Remembers a correction against the book's subjects and authors, so similar books get it right next time. */
export async function recordGenreChoice(db: ReadhoundDB, book: Pick<GenreBook, 'subjects' | 'authors'>, suggested: Iterable<GenreId>, chosen: Iterable<GenreId>): Promise<void> {
  const learned = await getSetting<GenreLearning>(db, SETTING_GENRE_LEARNING, {})
  const next = learnFromChoice(learned, learningTerms(book.subjects, book.authors), suggested, chosen)
  if (next !== learned) await db.settings.put({ key: SETTING_GENRE_LEARNING, value: next })
}

/** Library entries with no genre category, oldest first. */
export async function entriesWithoutGenre(db: ReadhoundDB): Promise<string[]> {
  const [entries, categories] = await Promise.all([db.entries.orderBy('addedAt').toArray(), db.categories.toArray()])
  const genreIds = new Set(categories.filter((c) => c.kind === 'genre').map((c) => c.id))
  return entries.filter((e) => !e.categoryIds.some((id) => genreIds.has(id))).map((e) => e.id)
}
