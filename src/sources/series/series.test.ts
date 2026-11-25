import { HttpClient, HttpError } from '../http'
import type { EditionDetails } from '../types'
import fixture from './__fixtures__/sparql-afdeling-q.json'
import { SeriesDetector } from './detect'
import { mapSeriesResponse, seriesQuery, WikidataSeriesLookup, type SparqlResponse } from './wikidata'

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
    const q = seriesQuery(['OL100W', 'OL5M', 'bad" } DROP'])
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
    expect(await lookup.seriesFor(['OL100W'])).toHaveLength(1)
    await lookup.seriesFor(['OL100W'])
    expect(urls).toHaveLength(1)
    expect(urls[0]).toMatch(/^https:\/\/query\.wikidata\.org\/sparql\?format=json&query=/)
    expect(await lookup.seriesFor(['manual-1'])).toEqual([])
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
