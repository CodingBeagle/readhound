import { HttpClient } from './http'
import { fixtureFetch } from './openlibrary/fixtureFetch'
import { OpenLibrarySource } from './openlibrary/OpenLibrarySource'
import { SourceRegistry } from './registry'
import type { BookSource, SearchResult } from './types'

function registry() {
  return new SourceRegistry([new OpenLibrarySource(new HttpClient({ fetch: fixtureFetch, sleep: async () => {} }))])
}

function stubSource(id: 'openlibrary' | 'manual', results: SearchResult[]): BookSource {
  return {
    id,
    search: vi.fn(async () => results),
    listEditions: async () => [],
    getEdition: async () => null,
    lookupIsbn: async () => null,
    getWork: async () => null,
  }
}

const result: SearchResult = {
  work: { source: 'manual', id: 'w' },
  title: 'Fallback',
  authors: [],
  editionCount: 1,
  languages: [],
}

describe('SourceRegistry', () => {
  it('runs an ISBN lookup first when the search text is a valid ISBN', async () => {
    const outcome = await registry().search({ text: '9780593135204' })
    expect(outcome).toMatchObject({ kind: 'isbn', source: 'openlibrary', edition: { title: 'Project Hail Mary' } })
  })

  it('returns work results for text searches', async () => {
    const outcome = await registry().search({ text: 'Project Hail Mary' })
    expect(outcome.kind).toBe('results')
    if (outcome.kind === 'results') expect(outcome.results[0]!.title).toBe('Project Hail Mary')
  })

  it('returns none when no source finds anything, so the UI can offer manual entry', async () => {
    expect(await registry().search({ text: 'xqzvwplk nonexistentbook' })).toEqual({ kind: 'none' })
  })

  it('falls through to the next source in priority order', async () => {
    const empty = stubSource('openlibrary', [])
    const fallback = stubSource('manual', [result])
    const outcome = await new SourceRegistry([empty, fallback]).search({ text: 'x' })
    expect(outcome).toEqual({ kind: 'results', source: 'manual', results: [result] })
  })

  it('stops at the first source with matches', async () => {
    const first = stubSource('openlibrary', [result])
    const second = stubSource('manual', [result])
    await new SourceRegistry([first, second]).search({ text: 'x' })
    expect(second.search).not.toHaveBeenCalled()
  })

  it('finds a source by id', () => {
    expect(registry().get('openlibrary')?.id).toBe('openlibrary')
    expect(registry().get('manual')).toBeUndefined()
  })
})
