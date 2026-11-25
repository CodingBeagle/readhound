import { HttpClient, type ResponseCache } from './http'
import { OpenLibrarySource } from './openlibrary/OpenLibrarySource'
import { SourceRegistry } from './registry'
import { SeriesDetector, WikidataSeriesLookup } from './series'

export { SourceRegistry, type SearchOutcome } from './registry'
export { parseIsbn } from './isbn'
export type * from './types'
export { SeriesDetector, WikidataSeriesLookup, type SeriesCandidate } from './series'

/**
 * Open Library asks apps to identify themselves with
 * `User-Agent: Readhound/<version> (<contact email>)`. Browsers can't send a
 * custom User-Agent to Open Library (its CORS rules don't allow the header,
 * so the request would fail), so it is only sent outside the browser, e.g.
 * from tests or a future native (Capacitor) HTTP layer.
 */
export function openLibraryUserAgent(): string {
  const contact = import.meta.env.VITE_OPENLIBRARY_CONTACT_EMAIL
  return `Readhound/${__APP_VERSION__}${contact ? ` (${contact})` : ''}`
}

/** Version 1 registry: Open Library only. Manual entry is handled by the UI when nothing is found. */
export function createDefaultRegistry(cache?: ResponseCache): SourceRegistry {
  const inBrowser = typeof window !== 'undefined'
  // Open Library allows 3 requests per second to identified apps and 1 to everyone else.
  const http = inBrowser
    ? new HttpClient({ maxRequestsPerSecond: 1, cache })
    : new HttpClient({ maxRequestsPerSecond: 3, cache, headers: { 'User-Agent': openLibraryUserAgent() } })
  return new SourceRegistry([new OpenLibrarySource(http)])
}

/**
 * Series detection: Wikidata, with Open Library's edition data as the
 * fallback. Wikidata's query service asks for a gentle pace, so at most
 * two requests a second, cached like Open Library responses.
 */
export function createSeriesDetector(registry: SourceRegistry, cache?: ResponseCache): SeriesDetector {
  const inBrowser = typeof window !== 'undefined'
  const http = new HttpClient({
    maxRequestsPerSecond: 2,
    cache,
    timeoutMs: 20_000,
    ...(!inBrowser && { headers: { 'User-Agent': openLibraryUserAgent() } }),
  })
  return new SeriesDetector({
    wikidata: new WikidataSeriesLookup(http),
    getEdition: async (ref) => (await registry.get(ref.source)?.getEdition(ref)) ?? null,
    listEditions: async (ref) => (await registry.get(ref.source)?.listEditions(ref, { limit: 50 })) ?? [],
  })
}
