import { HttpClient } from './http'
import { OpenLibrarySource } from './openlibrary/OpenLibrarySource'
import { SourceRegistry } from './registry'

export { SourceRegistry, type SearchOutcome } from './registry'
export { parseIsbn } from './isbn'
export type * from './types'

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
export function createDefaultRegistry(): SourceRegistry {
  const inBrowser = typeof window !== 'undefined'
  const http = new HttpClient({ headers: inBrowser ? {} : { 'User-Agent': openLibraryUserAgent() } })
  return new SourceRegistry([new OpenLibrarySource(http)])
}
