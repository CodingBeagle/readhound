/**
 * A fake `fetch` that answers Open Library URLs from recorded responses in
 * `__fixtures__`, so tests never hit the live API. Unknown URLs get a 404.
 */
import authorHoeg from './__fixtures__/author-OL365301A.json'
import authorHoeg2 from './__fixtures__/author-OL3218495A.json'
import authorWeir from './__fixtures__/author-OL7234434A.json'
import editionsSmilla from './__fixtures__/editions-OL258333W.json'
import isbnPhm from './__fixtures__/isbn-9780593135204.json'
import searchEmpty from './__fixtures__/search-empty.json'
import searchSmilla from './__fixtures__/search-froken-smilla.json'
import searchPhm from './__fixtures__/search-project-hail-mary.json'
import workPhm from './__fixtures__/work-OL21745884W.json'
import workSmilla from './__fixtures__/work-OL258333W.json'

const byPath: Record<string, unknown> = {
  '/isbn/9780593135204.json': isbnPhm,
  '/books/OL30036715M.json': isbnPhm,
  '/works/OL21745884W.json': workPhm,
  '/works/OL258333W.json': workSmilla,
  '/works/OL258333W/editions.json': editionsSmilla,
  '/authors/OL7234434A.json': authorWeir,
  '/authors/OL365301A.json': authorHoeg,
  '/authors/OL3218495A.json': authorHoeg2,
}

const searches: Record<string, unknown> = {
  'project hail mary': searchPhm,
  'froken smilla': searchSmilla,
}

export const fixtureFetch: typeof fetch = async (input) => {
  const url = new URL(String(input))
  let body: unknown
  if (url.pathname === '/search.json') {
    body = searches[(url.searchParams.get('q') ?? '').toLowerCase()] ?? searchEmpty
  } else {
    body = byPath[url.pathname]
  }
  return body === undefined
    ? new Response('Not found', { status: 404 })
    : new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
