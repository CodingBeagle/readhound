import { readFileSync } from 'node:fs'

import { test as base, expect, type Page } from '@playwright/test'

/** Recorded Open Library responses, shared with the unit tests. */
const FIXTURES = new URL('../src/sources/openlibrary/__fixtures__/', import.meta.url)
const fixture = (name: string) => readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8')

const byPath: Record<string, string> = {
  '/isbn/9780593135204.json': 'isbn-9780593135204',
  '/books/OL30036715M.json': 'isbn-9780593135204',
  '/works/OL21745884W.json': 'work-OL21745884W',
  '/works/OL258333W.json': 'work-OL258333W',
  '/works/OL258333W/editions.json': 'editions-OL258333W',
  '/works/OL17091839W/editions.json': 'editions-OL17091839W',
  '/authors/OL7234434A.json': 'author-OL7234434A',
  '/authors/OL365301A.json': 'author-OL365301A',
  '/authors/OL3218495A.json': 'author-OL3218495A',
}

const searches: Record<string, string> = {
  'project hail mary': 'search-project-hail-mary',
  'froken smilla': 'search-froken-smilla',
  'author:andy weir': 'search-author-andy-weir',
  'subject_key:science_fiction': 'search-subject-science-fiction',
}

const searchKey = (url: URL) => {
  const author = url.searchParams.get('author')
  return (author ? `author:${author}` : (url.searchParams.get('q') ?? '')).toLowerCase()
}

/** A 1×1 grey PNG for every cover request. */
const COVER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mOsrwcAAc8BJlNcK7wAAAAASUVORK5CYII=', 'base64')

async function stubOpenLibrary(page: Page) {
  await page.route('https://openlibrary.org/**', async (route) => {
    const url = new URL(route.request().url())
    const name =
      url.pathname === '/search.json' ? (searches[searchKey(url)] ?? 'search-empty') : byPath[url.pathname]
    if (!name) return route.fulfill({ status: 404, body: 'Not found' })
    await route.fulfill({ status: 200, contentType: 'application/json', body: fixture(name) })
  })
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: COVER }))
}

/** Wikidata's query service answers every series query with the Afdeling Q fixture. */
const WIKIDATA = readFileSync(new URL('../src/sources/series/__fixtures__/sparql-afdeling-q.json', import.meta.url), 'utf8')

async function stubWikidata(page: Page) {
  await page.route('https://query.wikidata.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/sparql-results+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: WIKIDATA }),
  )
}

/** Every test starts on an empty library with Open Library and Wikidata stubbed. */
export const test = base.extend<{ stubs: void }>({
  stubs: [
    async ({ page }, use) => {
      await stubOpenLibrary(page)
      await stubWikidata(page)
      await use()
    },
    { auto: true },
  ],
})

export { expect }
