/**
 * Series lookup on Wikidata (design doc, Series). Wikidata knows which
 * series a book belongs to ("part of the series", P179) and its number
 * ("series ordinal", P1545). Books are found by their Open Library ID
 * (P648) on the work, or on an edition that points to its work (P629).
 *
 * The query service at query.wikidata.org needs no key and allows browser
 * requests (CORS). Like Open Library, we send no custom headers from the
 * browser, so no preflight is needed, and responses are cached for 30 days.
 */
import type { HttpClient } from '../http'

export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
const DAY = 24 * 60 * 60 * 1000
export const WIKIDATA_TTL_MS = 30 * DAY
/** Labels in this order of preference. */
const LANGUAGES = 'da,en,mul'

export interface WikidataSeriesMember {
  wikidataId: string
  title: string
  position?: number
  olWorkId?: string
  authorName?: string
}

export interface WikidataSeries {
  wikidataId: string
  name: string
  /** This book's number in the series. */
  position?: number
  /** "Number of parts" on the series item, when stated. */
  totalBooks?: number
  /** Every book Wikidata lists in the series, this one included. */
  members: WikidataSeriesMember[]
}

interface Binding {
  type: string
  value: string
}
export interface SparqlResponse {
  results: { bindings: Record<string, Binding | undefined>[] }
}

const OLID = /^OL\d+[WM]$/

/** The SPARQL query for the series of the books with these Open Library IDs (works or editions). */
export function seriesQuery(olids: readonly string[]): string {
  const values = olids
    .filter((id) => OLID.test(id))
    .map((id) => `"${id}"`)
    .join(' ')
  return `SELECT ?series ?seriesLabel ?ordinal ?parts ?member ?memberLabel ?memberOrdinal ?memberOl ?authorLabel WHERE {
  VALUES ?olid { ${values} }
  { ?work wdt:P648 ?olid . } UNION { ?edition wdt:P648 ?olid ; wdt:P629 ?work . }
  ?work p:P179 ?statement . ?statement ps:P179 ?series .
  OPTIONAL { ?statement pq:P1545 ?ordinal . }
  OPTIONAL { ?series wdt:P2635 ?parts . }
  OPTIONAL {
    ?member p:P179 ?memberStatement . ?memberStatement ps:P179 ?series .
    FILTER NOT EXISTS { ?member wdt:P31 wd:Q3331189 . }
    OPTIONAL { ?memberStatement pq:P1545 ?memberOrdinal . }
    OPTIONAL { ?member wdt:P648 ?memberOl . FILTER(STRENDS(?memberOl, "W")) }
    OPTIONAL { ?member wdt:P50 ?author . }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGUAGES}". }
}
LIMIT 1000`
}

const qid = (uri: string | undefined) => uri?.slice(uri.lastIndexOf('/') + 1)

function ordinal(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number(value.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** A label the service filled in with the bare item ID means the item has no name in our languages. */
const hasLabel = (label: string | undefined, id: string | undefined): label is string => !!label && label !== id

/** Turns query results into one entry per series, members deduplicated and in order. */
export function mapSeriesResponse(response: SparqlResponse): WikidataSeries[] {
  const bySeries = new Map<string, WikidataSeries & { memberById: Map<string, WikidataSeriesMember> }>()
  for (const row of response.results.bindings) {
    const seriesId = qid(row.series?.value)
    if (!seriesId || !hasLabel(row.seriesLabel?.value, seriesId)) continue
    let series = bySeries.get(seriesId)
    if (!series) {
      const parts = ordinal(row.parts?.value)
      series = {
        wikidataId: seriesId,
        name: row.seriesLabel!.value,
        position: ordinal(row.ordinal?.value),
        totalBooks: parts && Number.isInteger(parts) && parts > 0 ? parts : undefined,
        members: [],
        memberById: new Map(),
      }
      bySeries.set(seriesId, series)
    }
    series.position ??= ordinal(row.ordinal?.value)
    const memberId = qid(row.member?.value)
    if (!memberId || !hasLabel(row.memberLabel?.value, memberId)) continue
    const existing = series.memberById.get(memberId)
    if (existing) {
      existing.position ??= ordinal(row.memberOrdinal?.value)
      existing.olWorkId ??= row.memberOl?.value
      existing.authorName ??= row.authorLabel?.value
      continue
    }
    const member: WikidataSeriesMember = {
      wikidataId: memberId,
      title: row.memberLabel!.value,
      position: ordinal(row.memberOrdinal?.value),
      olWorkId: row.memberOl?.value,
      authorName: hasLabel(row.authorLabel?.value, undefined) ? row.authorLabel!.value : undefined,
    }
    series.memberById.set(memberId, member)
    series.members.push(member)
  }
  return [...bySeries.values()].map(({ memberById: _, ...series }) => ({
    ...series,
    members: series.members.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.title.localeCompare(b.title)),
  }))
}

export class WikidataSeriesLookup {
  private readonly http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /** Series of the book with these Open Library IDs. Empty when Wikidata doesn't know the book. */
  async seriesFor(olids: readonly string[], signal?: AbortSignal): Promise<WikidataSeries[]> {
    if (!olids.some((id) => OLID.test(id))) return []
    const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(seriesQuery(olids))}`
    const response = await this.http.getJson<SparqlResponse>(url, { cacheTtlMs: WIKIDATA_TTL_MS, signal })
    return response ? mapSeriesResponse(response) : []
  }
}
