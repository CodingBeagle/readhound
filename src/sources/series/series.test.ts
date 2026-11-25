import { HttpClient, HttpError } from '../http'
import type { EditionDetails } from '../types'
import fixture from './__fixtures__/sparql-afdeling-q.json'
import { mostCommonSeries, SeriesDetector } from './detect'
import { HttpClient as Http } from '../http'
import { fixtureFetch } from '../openlibrary/fixtureFetch'
import { OpenLibrarySource } from '../openlibrary/OpenLibrarySource'
import { mapSeriesResponse, seriesQuery, sparqlString, WikidataSeriesLookup, type SparqlResponse } from './wikidata'

const response = fixture as SparqlResponse

describe('Wikidata series lookup', () => {
  it('maps query rows to one series with ordered, deduplicated members', () => {
    const [series, ...rest] = mapSeriesResponse(response)
    expect(rest).toEqual([])
    expect(series).toMatchObject({ wikidataId: 'Q1093045', name: 'Afdeling Q', position: 1 })
    expect(series!.members).toEqual([
      { wikidataId: 'Q100', title: 'Kvinden i buret', position: 1, olWorkId: 'OL100W', authorName: 'Jussi Adler-Olsen' },
      { wikidataId: 'Q200', title: 'Fasandræberne', position: 2, olWorkId: 'OL200W', authorName: 'Jussi Adler-Olsen' },
      { wikidataId: 'Q300', title: 'Flaskepost fra P', position: 3, olWorkId: undefined, authorName: 'Jussi Adler-Olsen' },
    ])
  })

  it('queries by Open Library work and edition IDs, ignoring anything else', () => {
    const q = seriesQuery({ olids: ['OL100W', 'OL5M', 'bad" } DROP'] })
    expect(q).toContain('VALUES ?olid { "OL100W" "OL5M" }')
    expect(q).not.toContain('DROP')
    expect(q).toContain('ps:P179')
  })

  it('sends a plain GET to the query service and caches it', async () => {
    const urls: string[] = []
    const fetch: typeof globalThis.fetch = async (input, init) => {
      urls.push(String(input))
      expect(Object.keys((init?.headers as Record<string, string>) ?? {})).toEqual(['Accept'])
      return new Response(JSON.stringify(fixture), { status: 200 })
    }
    const lookup = new WikidataSeriesLookup(new HttpClient({ fetch, sleep: async () => {} }))
    expect(await lookup.seriesFor({ olids: ['OL100W'] })).toHaveLength(1)
    await lookup.seriesFor({ olids: ['OL100W'] })
    expect(urls).toHaveLength(1)
    expect(urls[0]).toMatch(/^https:\/\/query\.wikidata\.org\/sparql\?format=json&query=/)
    expect(await lookup.seriesFor({ olids: ['manual-1'] })).toEqual([])
  })
})

describe('series detector', () => {
  const edition = { source: 'openlibrary', id: 'OL1M' } as const
  const work = { source: 'openlibrary', id: 'OL100W' } as const
  const olEdition = { series: [{ name: 'Afdeling Q', position: 1 }] } as EditionDetails

  it('prefers Wikidata', async () => {
    const detector = new SeriesDetector({ wikidata: { seriesFor: async () => mapSeriesResponse(response) } as unknown as WikidataSeriesLookup, getEdition: async () => olEdition })
    const [best] = await detector.detect({ work, edition })
    expect(best).toMatchObject({ origin: 'wikidata', name: 'Afdeling Q', position: 1, wikidataId: 'Q1093045' })
    expect(best!.members).toHaveLength(3)
  })

  it('falls back to the Open Library series label when Wikidata has nothing or fails', async () => {
    const none = new SeriesDetector({ wikidata: { seriesFor: async () => [] } as unknown as WikidataSeriesLookup, getEdition: async () => olEdition })
    expect(await none.detect({ work, edition })).toEqual([{ name: 'Afdeling Q', position: 1, origin: 'openlibrary', members: [] }])
    const failing = new SeriesDetector({
      wikidata: { seriesFor: async () => Promise.reject(new HttpError(403, 'x')) } as unknown as WikidataSeriesLookup,
      getEdition: async () => olEdition,
    })
    expect((await failing.detect({ work, edition }))[0]!.origin).toBe('openlibrary')
  })

  it('does nothing for manual books, and throws when both sources fail', async () => {
    const broken = new SeriesDetector({
      wikidata: { seriesFor: async () => Promise.reject(new TypeError('offline')) } as unknown as WikidataSeriesLookup,
      getEdition: async () => Promise.reject(new TypeError('offline')),
    })
    expect(await broken.detect({})).toEqual([])
    await expect(broken.detect({ work, edition })).rejects.toThrow('offline')
  })
})

describe("Assassin's Apprentice (Farseer Trilogy, book 1)", () => {
  const work = { source: 'openlibrary', id: 'OL2707183W' } as const
  // The edition Kasper added: an English paperback whose own record has no series label.
  const edition = { source: 'openlibrary', id: 'OL7259162M' } as const
  const ol = new OpenLibrarySource(new Http({ fetch: fixtureFetch, sleep: async () => {} }))

  it('also looks the book up on Wikidata by title and author, with both apostrophes', () => {
    const q = seriesQuery({ olids: ['OL2707183W'], titles: ["Assassin's Apprentice"], authors: ['Robin Hobb'] })
    expect(q).toContain('UNION')
    expect(q).toContain(`"Assassin's Apprentice"@en`)
    expect(q).toContain('"Assassin’s Apprentice"@en')
    expect(q).toContain('"Robin Hobb"@mul')
    expect(q).toContain('wdt:P50')
    expect(sparqlString('Say "hi" \\ bye')).toBe('"Say \\"hi\\" \\\\ bye"')
  })

  it('reads the series from the other editions when this one has none', async () => {
    const editions = await ol.listEditions(work)
    expect(editions.filter((e) => e.series?.length).length).toBeGreaterThan(5)
    expect(mostCommonSeries(editions)).toEqual([{ name: 'Farseer Trilogy', position: 1 }])
  })

  it('finds the Farseer Trilogy when Wikidata has nothing', async () => {
    const detector = new SeriesDetector({
      wikidata: { seriesFor: async () => [] } as unknown as WikidataSeriesLookup,
      getEdition: async () => null,
      listEditions: (ref) => ol.listEditions(ref),
    })
    const [best] = await detector.detect({ work, edition, titles: ["Assassin's Apprentice"], authors: ['Robin Hobb'] })
    expect(best).toMatchObject({ name: 'Farseer Trilogy', position: 1, origin: 'openlibrary' })
  })

  it('passes the title and author to Wikidata', async () => {
    let asked: unknown
    const detector = new SeriesDetector({
      wikidata: { seriesFor: async (book: unknown) => ((asked = book), []) } as unknown as WikidataSeriesLookup,
      getEdition: async () => null,
    })
    await detector.detect({ work, edition, titles: ["Assassin's Apprentice"], authors: ['Robin Hobb'] })
    expect(asked).toEqual({ olids: ['OL2707183W', 'OL7259162M'], titles: ["Assassin's Apprentice"], authors: ['Robin Hobb'] })
  })
})
