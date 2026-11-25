import 'fake-indexeddb/auto'

import { HttpClient } from '@/sources/http'
import { fixtureFetch } from '@/sources/openlibrary/fixtureFetch'
import { OpenLibrarySource } from '@/sources/openlibrary/OpenLibrarySource'
import { SourceRegistry } from '@/sources/registry'
import { genreQuery, mapGenreResponse, WikidataGenreLookup } from '@/sources/genres/wikidataGenres'
// A hand-written answer in the query service's JSON format (the sandbox can't reach Wikidata to record one).
import sampleGenres from '@/sources/genres/__fixtures__/sparql-genres-sample.json'

import type { Clock } from './clock'
import { CollectionsRepository } from './collections'
import {
  applyGenres,
  entriesWithoutGenre,
  genreBookForEntry,
  localGenreEvidence,
  recordGenreChoice,
  SETTING_GENRE_LEARNING,
  showSuggestions,
  suggestGenresFor,
} from './genres'
import { LibraryRepository } from './library'
import { ReadhoundDB } from './schema'
import { SeriesRepository } from './series'

const clock: Clock = { now: () => new Date('2026-11-25T09:00:00Z'), timeZone: () => 'Europe/Copenhagen' }
let db: ReadhoundDB
let library: LibraryRepository
let collections: CollectionsRepository
let series: SeriesRepository
let wikidataCalls: string[]

const network = (answer: unknown = sampleGenres) => ({
  sources: new SourceRegistry([new OpenLibrarySource(new HttpClient({ fetch: fixtureFetch, sleep: async () => {} }))]),
  genreLookup: new WikidataGenreLookup(
    new HttpClient({
      fetch: async (input) => {
        wikidataCalls.push(decodeURIComponent(String(input)))
        return new Response(JSON.stringify(answer), { status: 200 })
      },
      sleep: async () => {},
    }),
  ),
})

beforeEach(async () => {
  db = new ReadhoundDB(`genres-${crypto.randomUUID()}`)
  await db.open()
  library = new LibraryRepository(db, clock)
  collections = new CollectionsRepository(db, clock)
  series = new SeriesRepository(db, clock)
  wikidataCalls = []
})
afterEach(async () => {
  await db.delete()
})

const add = async (title: string, author: string, categoryIds: string[] = []) => (await library.addManual({ title, authors: [author] }, { categoryIds })).entryId
const workOf = async (entryId: string) => (await db.editions.get((await db.entries.get(entryId))!.editionId))!.workId

describe('Wikidata genres', () => {
  it('asks for the genre of the book found by id or by title and author, and keeps named genres', () => {
    const query = genreQuery({ olids: ['OL258333W'], titles: ['Frøken Smillas fornemmelse for sne'], authors: ['Peter Høeg'] })
    expect(query).toContain('wdt:P136 ?genre')
    expect(query).toContain('"OL258333W"')
    expect(query).toContain('"Peter Høeg"@da')
    expect(mapGenreResponse(sampleGenres)).toEqual(['crime novel', 'thriller'])
  })
})

describe('gathering evidence', () => {
  it('falls back to the series and the author', async () => {
    const krimi = await collections.createCategory({ name: 'Krimi', kind: 'genre', isFiction: true })
    const shelf = await collections.createCategory({ name: 'Favourites', kind: 'shelf' })
    const first = await add('Kvinden i buret', 'Jussi Adler-Olsen', [krimi, shelf])
    const second = await add('Fasandræberne', 'Jussi Adler-Olsen', [krimi])
    const third = await add('Flaskepost fra P', 'Jussi Adler-Olsen')
    const sid = await series.createSeries({ name: 'Afdeling Q' })
    for (const [i, id] of [first, second, third].entries()) await series.setWorkSeries(await workOf(id), sid, { position: i + 1 })

    const book = (await genreBookForEntry(db, third))!
    const evidence = await localGenreEvidence(db, book)
    expect(evidence.seriesGenres).toEqual(['crime', 'crime'])
    expect(evidence.authorGenres).toEqual([['crime'], ['crime']])

    const suggestions = await suggestGenresFor(db, book)
    expect(suggestions).toMatchObject([{ genre: 'crime', sources: ['series', 'author'] }])
    // Shown as the reader's own "Krimi" category.
    expect(showSuggestions(suggestions, await db.categories.toArray())).toMatchObject([{ genre: 'crime', name: 'Krimi', categoryId: krimi }])
  })

  it('adds every edition and Wikidata when online', async () => {
    const book = { olWorkId: 'OL258333W', titles: ['Frøken Smillas fornemmelse for sne'], authors: ['Peter Høeg'], subjects: [] }
    const suggestions = await suggestGenresFor(db, book, network())
    expect(suggestions.map((s) => s.genre)).toEqual(['crime', 'thriller'])
    expect(suggestions[0]!.sources).toEqual(['wikidata'])
    expect(wikidataCalls[0]).toContain('"OL258333W"')

    // The Martian: one edition says science fiction, which adds to the book's own subject.
    const martian = { olWorkId: 'OL17091839W', titles: ['The Martian'], authors: ['Andy Weir'], subjects: ['Science fiction'] }
    const [scifi] = await suggestGenresFor(db, martian, network({ results: { bindings: [] } }))
    expect(scifi).toMatchObject({ genre: 'scifi', score: 1.5 + 0.5, sources: ['subjects', 'editions'] })
  })
})

describe('applying and learning', () => {
  it('applies genres, creating categories the reader lacks, and finds books without a genre', async () => {
    const krimi = await collections.createCategory({ name: 'Krimi', kind: 'genre', isFiction: true })
    const a = await add('A', 'Someone')
    const b = await add('B', 'Someone')
    expect((await entriesWithoutGenre(db)).sort()).toEqual([a, b].sort())

    await applyGenres(db, collections, a, ['crime', 'thriller'])
    const categories = await db.categories.toArray()
    expect(categories.map((c) => c.name).sort()).toEqual(['Krimi', 'Thriller'])
    expect(categories.find((c) => c.name === 'Thriller')).toMatchObject({ kind: 'genre', isFiction: true })
    expect((await db.entries.get(a))!.categoryIds).toContain(krimi)
    expect(await entriesWithoutGenre(db)).toEqual([b])
  })

  it('remembers corrections so the next book by the author gets them', async () => {
    await recordGenreChoice(db, { subjects: [], authors: ['Ny Forfatter'] }, [], ['horror'])
    await recordGenreChoice(db, { subjects: [], authors: ['Ny Forfatter'] }, [], ['horror'])
    expect((await db.settings.get(SETTING_GENRE_LEARNING))!.value).toEqual({ 'a:ny forfatter': { horror: 2 } })
    const next = await suggestGenresFor(db, { titles: ['Next'], authors: ['Ny Forfatter'], subjects: [] })
    expect(next).toMatchObject([{ genre: 'horror', sources: ['learned'] }])
  })
})
