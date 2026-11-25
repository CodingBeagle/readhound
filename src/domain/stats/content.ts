import { monthOf, yearOf } from './calendar'
import type { StatRead, StatsModel } from './model'
import { inPeriod, type Period } from './period'
import { attributeReads } from './totals'

export interface Count<K = string> {
  key: K
  count: number
}

function countBy<K>(items: readonly StatRead[], keys: (r: StatRead) => readonly K[]): Count<K>[] {
  const map = new Map<K, number>()
  for (const r of items) for (const k of keys(r)) map.set(k, (map.get(k) ?? 0) + 1)
  return [...map].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

const UNKNOWN = 'unknown'

/** Finished reads per genre per month (or year), for a stacked bar chart. Books without a genre count as "unknown". */
export function genresOverTime(model: StatsModel, period: Period, by: 'month' | 'year', includeDnf = false) {
  const reads = attributeReads(model, period, includeDnf)
  const buckets = new Map<string, Map<string, number>>()
  for (const r of reads) {
    const bucket = by === 'month' ? monthOf(r.endedOn!) : String(yearOf(r.endedOn!))
    const row = buckets.get(bucket) ?? new Map<string, number>()
    const genres = r.book.genres.length ? r.book.genres.map((g) => g.id) : [UNKNOWN]
    // A book in two genres counts half in each, so each bar still adds up to the books read.
    for (const g of genres) row.set(g, (row.get(g) ?? 0) + 1 / genres.length)
    buckets.set(bucket, row)
  }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, row]) => ({ bucket, genres: Object.fromEntries(row) as Record<string, number> }))
}

/** Finished reads per author, most read first. */
export function topAuthors(model: StatsModel, period: Period, includeDnf = false) {
  const reads = attributeReads(model, period, includeDnf)
  const names = new Map(reads.flatMap((r) => r.book.authors.map((a) => [a.id, a.name] as const)))
  return countBy(reads, (r) => r.book.authors.map((a) => a.id))
    .map((c) => ({ authorId: c.key, name: names.get(c.key) ?? '', count: c.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'da'))
}

/** An author is new in the period if none of their works had a finished read before the period started. */
export function newVsReturningAuthors(model: StatsModel, period: Period, includeDnf = false): { new: number; returning: number } {
  const before = new Set(
    model.reads
      .filter((r) => r.outcome === 'finished' && r.endedOn && period.from && r.endedOn < period.from)
      .flatMap((r) => r.book.authors.map((a) => a.id)),
  )
  const inPeriodAuthors = new Set(attributeReads(model, period, includeDnf).flatMap((r) => r.book.authors.map((a) => a.id)))
  let fresh = 0
  for (const a of inPeriodAuthors) if (!before.has(a)) fresh += 1
  return { new: fresh, returning: inPeriodAuthors.size - fresh }
}

export function languages(model: StatsModel, period: Period, includeDnf = false): Count[] {
  return countBy(attributeReads(model, period, includeDnf), (r) => [r.book.language ?? UNKNOWN])
}

/** Translated if the edition's language differs from the work's original language; unknown if either is missing. */
export function originalsVsTranslations(model: StatsModel, period: Period, includeDnf = false) {
  const result = { original: 0, translated: 0, unknown: 0 }
  for (const r of attributeReads(model, period, includeDnf)) {
    const { language, originalLanguage } = r.book
    if (!language || !originalLanguage) result.unknown += 1
    else if (language === originalLanguage) result.original += 1
    else result.translated += 1
  }
  return result
}

/** Finished reads per publication decade (first publication), oldest first. */
export function publicationDecades(model: StatsModel, period: Period, includeDnf = false): Count<number | 'unknown'>[] {
  return countBy<number | 'unknown'>(attributeReads(model, period, includeDnf), (r) =>
    r.book.firstPublishYear === undefined ? [UNKNOWN] : [Math.floor(r.book.firstPublishYear / 10) * 10],
  ).sort((a, b) => (a.key === UNKNOWN ? 1 : b.key === UNKNOWN ? -1 : (a.key as number) - (b.key as number)))
}

export const LENGTH_BUCKETS = ['<200', '200–349', '350–499', '500–749', '750+'] as const
export type LengthBucket = (typeof LENGTH_BUCKETS)[number]

export function lengthBucket(pages: number): LengthBucket {
  return pages < 200 ? '<200' : pages < 350 ? '200–349' : pages < 500 ? '350–499' : pages < 750 ? '500–749' : '750+'
}

/** Finished reads by page count bucket; books without a page count are left out and counted separately. */
export function lengthDistribution(model: StatsModel, period: Period, includeDnf = false) {
  const counts = Object.fromEntries(LENGTH_BUCKETS.map((b) => [b, 0])) as Record<LengthBucket, number>
  let unknown = 0
  for (const r of attributeReads(model, period, includeDnf)) {
    if (r.book.pageCount) counts[lengthBucket(r.book.pageCount)] += 1
    else unknown += 1
  }
  return { buckets: LENGTH_BUCKETS.map((bucket) => ({ bucket, count: counts[bucket] })), unknown }
}

export function fictionSplit(model: StatsModel, period: Period, includeDnf = false) {
  const result = { fiction: 0, nonfiction: 0, unknown: 0 }
  for (const r of attributeReads(model, period, includeDnf)) {
    if (r.book.isFiction === true) result.fiction += 1
    else if (r.book.isFiction === false) result.nonfiction += 1
    else result.unknown += 1
  }
  return result
}

/** Works with more than one finished read in total, listed when at least one of those reads ends in the period. */
export function rereads(model: StatsModel, period: Period = {}) {
  const byWork = new Map<string, StatRead[]>()
  for (const r of model.reads) if (r.outcome === 'finished') byWork.set(r.book.workId, [...(byWork.get(r.book.workId) ?? []), r])
  return [...byWork.values()]
    .filter((reads) => reads.length > 1 && reads.some((r) => inPeriod(r.endedOn, period)))
    .map((reads) => ({ title: reads[0]!.book.title, authors: reads[0]!.book.authors.map((a) => a.name), count: reads.length }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
}

/** Finished reads per author country (ISO 3166-1 alpha-2); authors without a country under "unknown". */
export function authorCountries(model: StatsModel, period: Period, includeDnf = false): Count[] {
  return countBy(attributeReads(model, period, includeDnf), (r) => {
    const countries = [...new Set(r.book.authors.map((a) => a.country ?? UNKNOWN))]
    return countries.length ? countries : [UNKNOWN]
  })
}

/** Rating against page count, one point per finished read with both. */
export function ratingsVsLength(model: StatsModel, period: Period, includeDnf = false) {
  return attributeReads(model, period, includeDnf).flatMap((r) =>
    r.book.entry.rating !== undefined && r.book.pageCount ? [{ title: r.book.title, pages: r.book.pageCount, rating: r.book.entry.rating }] : [],
  )
}

/** Average rating per genre over rated finished reads. */
export function ratingsByGenre(model: StatsModel, period: Period, includeDnf = false) {
  const sums = new Map<string, { total: number; count: number }>()
  for (const r of attributeReads(model, period, includeDnf)) {
    const rating = r.book.entry.rating
    if (rating === undefined) continue
    for (const g of r.book.genres) {
      const s = sums.get(g.id) ?? { total: 0, count: 0 }
      s.total += rating
      s.count += 1
      sums.set(g.id, s)
    }
  }
  return [...sums].map(([genreId, s]) => ({ genreId, average: s.total / s.count, count: s.count })).sort((a, b) => b.average - a.average)
}
