import { HttpClient } from '../http'
import { fixtureFetch } from './fixtureFetch'
import { OpenLibrarySource } from './OpenLibrarySource'

const noWait = { sleep: async () => {} }

function source(fetch: typeof globalThis.fetch = fixtureFetch) {
  return new OpenLibrarySource(new HttpClient({ fetch, ...noWait }))
}

describe('OpenLibrarySource (recorded responses)', () => {
  it('finds Project Hail Mary first and filters out summary books', async () => {
    const results = await source().search({ text: 'Project Hail Mary' })
    expect(results[0]).toMatchObject({
      work: { source: 'openlibrary', id: 'OL21745884W' },
      title: 'Project Hail Mary',
      authors: [{ ref: { source: 'openlibrary', id: 'OL7234434A' }, name: 'Andy Weir' }],
      firstPublishYear: 2021,
      coverUrl: 'https://covers.openlibrary.org/b/id/11200092-M.jpg',
    })
    expect(results[0]!.editionCount).toBeGreaterThan(1)
    expect(results.some((r) => /^summary/i.test(r.title))).toBe(false)
  })

  it('builds the search URL with the spec fields and limit', async () => {
    const urls: string[] = []
    const fetch: typeof globalThis.fetch = async (input, init) => {
      urls.push(String(input))
      return fixtureFetch(input, init)
    }
    await source(fetch).search({ text: 'froken smilla' })
    const url = new URL(urls[0]!)
    expect(url.pathname).toBe('/search.json')
    expect(url.searchParams.get('q')).toBe('froken smilla')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('fields')).toBe(
      'key,title,author_name,author_key,first_publish_year,edition_count,language,number_of_pages_median,cover_i',
    )
  })

  it('finds "Frøken Smillas fornemmelse for sne" from "froken smilla"', async () => {
    const results = await source().search({ text: 'froken smilla' })
    expect(results[0]).toMatchObject({ title: 'Frøken Smillas fornemmelse for sne' })
    expect(results[0]!.languages).toContain('dan')
  })

  it('returns no results for an unknown book', async () => {
    expect(await source().search({ text: 'xqzvwplk nonexistentbook' })).toEqual([])
  })

  it('looks up an edition by ISBN with author names', async () => {
    const edition = await source().lookupIsbn('978-0-593-13520-4')
    expect(edition).toMatchObject({
      edition: { source: 'openlibrary', id: 'OL30036715M' },
      work: { source: 'openlibrary', id: 'OL21745884W' },
      title: 'Project Hail Mary',
      authors: [{ name: 'Andy Weir' }],
      isbn13: ['9780593135204'],
      isbn10: ['0593135202'],
      publishers: ['Ballantine Books'],
      publishDate: 'May 04, 2021',
      publishYear: 2021,
      pageCount: 496,
      language: 'eng',
      format: 'hardcover',
      coverUrl: 'https://covers.openlibrary.org/b/id/12455001-M.jpg',
    })
  })

  it('returns null when an ISBN is not found', async () => {
    expect(await source().lookupIsbn('9780000000002')).toBeNull()
  })

  it('gets an edition by its OLID', async () => {
    const edition = await source().getEdition({ source: 'openlibrary', id: 'OL30036715M' })
    expect(edition?.title).toBe('Project Hail Mary')
  })

  it('lists editions of a work, borrowing the work authors when editions have none', async () => {
    const editions = await source().listEditions({ source: 'openlibrary', id: 'OL258333W' })
    expect(editions.length).toBeGreaterThan(0)
    for (const e of editions) {
      expect(e.work).toEqual({ source: 'openlibrary', id: 'OL258333W' })
      expect(e.authors.length).toBeGreaterThan(0)
    }
  })

  it('filters editions by language', async () => {
    const danish = await source().listEditions({ source: 'openlibrary', id: 'OL258333W' }, { language: 'dan' })
    expect(danish.length).toBeGreaterThan(0)
    expect(danish.every((e) => e.language === 'dan')).toBe(true)
    expect(danish[0]).toMatchObject({ title: expect.stringMatching(/^Frøken Smillas fornemmelse for sne/), publishYear: 1992 })
  })

  it('gets a work with a normalised description and subjects', async () => {
    const work = await source().getWork({ source: 'openlibrary', id: 'OL21745884W' })
    expect(work?.description).toMatch(/^Ryland Grace is the sole survivor/)
    expect(work?.subjects).toContain('science-fiction')
  })

  it('caches records so repeat lookups make no new requests', async () => {
    let calls = 0
    const fetch: typeof globalThis.fetch = async (input, init) => {
      calls++
      return fixtureFetch(input, init)
    }
    const s = source(fetch)
    await s.lookupIsbn('9780593135204')
    const first = calls
    await s.lookupIsbn('9780593135204')
    expect(calls).toBe(first)
  })
})
