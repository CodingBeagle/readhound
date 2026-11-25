/**
 * Book suggestions from a taste profile (design doc, Recommendations).
 *
 * Everything runs on the device. The profile learns which authors, subjects,
 * decades, lengths and languages the reader rates highly. Its strongest
 * authors and subjects become catalog searches, and the hits are ranked
 * against the whole profile, with a short reason for each pick.
 *
 * The ranking is a plain weighted sum over named signals, so a smarter
 * similarity signal (for example in-browser text embeddings) can be added
 * later as one more term in `scoreCandidate`.
 */
import type { SearchQuery, SearchResult } from '@/sources/types'

import { GENRE_BY_ID, genreForCategory, genresOfSubject, type GenreId } from './genres'

import type { StatBook, StatsModel } from './stats/model'
import { normalizeTerm, usefulSubject } from './terms'

export type LengthBand = 'short' | 'medium' | 'long' | 'epic'

export interface ProfileEntry {
  /** As first seen, for display. */
  label: string
  score: number
  /** For a subject that is one of the reader's genre categories: the genre it stands for. */
  genre?: GenreId
  /** The best-liked book behind this entry, for "because you loved …". */
  loved?: { title: string; weight: number }
}

export interface TasteProfile {
  authors: Map<string, ProfileEntry>
  subjects: Map<string, ProfileEntry>
  decades: Map<number, number>
  lengths: Map<LengthBand, number>
  languages: Map<string, number>
  /** Books that said something about the reader's taste. */
  signals: number
  /** Work source ids and title+author keys of every book in the library. */
  owned: { workIds: Set<string>; keys: Set<string> }
}

export type Reason =
  | { kind: 'author'; author: string; book?: string }
  | { kind: 'subject'; subject: string; book?: string }
  | { kind: 'series'; series: string; position?: number }

/** Open Library work id → the series it is the next unread book of (see `nextInSeries` in series.ts). */
export type SeriesNext = ReadonlyMap<string, { series: string; position?: number }>

export interface Seed {
  kind: 'author' | 'subject'
  label: string
  query: SearchQuery
}

export interface Candidate {
  result: SearchResult
  seed: Seed
}

export interface Recommendation {
  result: SearchResult
  score: number
  reason: Reason
}

export { normalizeTerm, usefulSubject } from './terms'

export function lengthBand(pages: number | undefined): LengthBand | undefined {
  if (!pages) return undefined
  return pages < 200 ? 'short' : pages < 400 ? 'medium' : pages < 600 ? 'long' : 'epic'
}

/** "Title|first author", for spotting a book already in the library when there's no shared source id. */
export function bookKey(title: string, author: string | undefined): string {
  const t = normalizeTerm(title.split(/[:(]/)[0] ?? title)
  return `${t}|${normalizeTerm(author ?? '')}`
}

/**
 * How much a book says about the reader's taste: rating − 2.5 when rated
 * (5 → 2.5, 1 → −1.5), a favourite adds 1, an unrated finish counts 0.5 and
 * a DNF −1. Books still to read or in progress say nothing yet.
 */
export function bookWeight(book: StatBook, finishedReads: number): number {
  const { rating, favourite, status } = book.entry
  let weight: number
  if (rating !== undefined) weight = rating - 2.5
  else if (favourite) weight = 1.5
  else if (status === 'finished' || finishedReads > 0) weight = 0.5
  else if (status === 'dnf') weight = -1
  else return 0
  if (favourite && rating !== undefined) weight += 1
  if (finishedReads > 1) weight += 0.5
  return weight
}

function add<K>(map: Map<K, number>, key: K | undefined, value: number) {
  if (key === undefined) return
  map.set(key, (map.get(key) ?? 0) + value)
}

function addEntry(map: Map<string, ProfileEntry>, key: string, label: string, value: number, title: string) {
  const entry = map.get(key) ?? { label, score: 0 }
  entry.score += value
  if (value > 0 && (!entry.loved || value > entry.loved.weight)) entry.loved = { title, weight: value }
  map.set(key, entry)
}

/** Builds the taste profile from the library. */
export function tasteProfile(model: StatsModel): TasteProfile {
  const finished = new Map<string, number>()
  for (const r of model.reads) if (r.outcome === 'finished') finished.set(r.entryId, (finished.get(r.entryId) ?? 0) + 1)

  const profile: TasteProfile = {
    authors: new Map(),
    subjects: new Map(),
    decades: new Map(),
    lengths: new Map(),
    languages: new Map(),
    signals: 0,
    owned: { workIds: new Set(), keys: new Set() },
  }

  for (const book of model.books) {
    if (book.work?.sourceRef) profile.owned.workIds.add(book.work.sourceRef.id)
    for (const title of new Set([book.title, book.work?.title ?? book.title])) {
      for (const author of book.authors.length ? book.authors : [undefined]) profile.owned.keys.add(bookKey(title, author?.name))
    }

    const weight = bookWeight(book, finished.get(book.entry.id) ?? 0)
    if (weight === 0) continue
    profile.signals++

    for (const author of book.authors) addEntry(profile.authors, normalizeTerm(author.name), author.name, weight, book.title)
    const terms = new Map<string, string>()
    for (const genre of book.genres) {
      const term = normalizeTerm(genre.name)
      if (term) terms.set(term, genre.name)
    }
    for (const subject of (book.work?.subjects ?? []).slice(0, 25)) {
      const term = usefulSubject(subject)
      if (term && !terms.has(term) && terms.size < 15) terms.set(term, subject)
    }
    // Genres the reader picked count fully, source subjects half.
    for (const [term, label] of terms) {
      const category = book.genres.find((g) => normalizeTerm(g.name) === term)
      addEntry(profile.subjects, term, label, category ? weight : weight / 2, book.title)
      if (category) profile.subjects.get(term)!.genre ??= genreForCategory(category.name)
    }
    add(profile.decades, book.firstPublishYear === undefined ? undefined : Math.floor(book.firstPublishYear / 10) * 10, weight)
    add(profile.lengths, lengthBand(book.pageCount), weight)
    add(profile.languages, book.language, weight)
  }
  return profile
}

function top(map: Map<string, ProfileEntry>, n: number): ProfileEntry[] {
  return [...map.values()]
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, n)
}

/** The catalog searches to run: the three strongest authors and the three strongest subjects. */
export function seedsFor(profile: TasteProfile, { authors = 3, subjects = 3 } = {}): Seed[] {
  return [
    ...top(profile.authors, authors).map((e): Seed => ({ kind: 'author', label: e.label, query: { author: e.label, popular: true, withSubjects: true, limit: 10 } })),
    // A genre category searches Open Library's own subject for it ("Krimi" → mystery and detective stories).
    ...top(profile.subjects, subjects).map(
      (e): Seed => ({ kind: 'subject', label: e.label, query: { subject: e.genre ? GENRE_BY_ID.get(e.genre)!.olSubject : e.label, popular: true, withSubjects: true, limit: 15 } }),
    ),
  ]
}

/** Each map's values scaled so the strongest one is ±1. */
function scaled<K>(map: Map<K, number>): Map<K, number> {
  const max = Math.max(0, ...[...map.values()].map(Math.abs))
  return new Map(max ? [...map].map(([k, v]) => [k, v / max]) : [])
}

interface Scales {
  authors: Map<string, number>
  /** Subject key, scaled score, and the genre it stands for when it is a genre category. */
  subjects: [string, number, GenreId | undefined][]
  decades: Map<number, number>
  lengths: Map<LengthBand, number>
  languages: Map<string, number>
}

function scalesFor(profile: TasteProfile): Scales {
  const authors = scaled(new Map([...profile.authors].map(([k, e]) => [k, e.score])))
  const subjects = scaled(new Map([...profile.subjects].map(([k, e]) => [k, e.score])))
  return {
    authors,
    // The 30 strongest subjects either way, so a match check stays cheap.
    subjects: [...subjects]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 30)
      .map(([k, v]) => [k, v, profile.subjects.get(k)?.genre]),
    decades: scaled(profile.decades),
    lengths: scaled(profile.lengths),
    languages: scaled(profile.languages),
  }
}

interface Score {
  total: number
  author?: { key: string; value: number }
  subject?: { key: string; value: number }
}

/** The ranking: a weighted sum of how well the book fits each part of the profile. */
function scoreCandidate(result: SearchResult, s: Scales): Score {
  let author: Score['author']
  for (const a of result.authors) {
    const key = normalizeTerm(a.name)
    const value = s.authors.get(key)
    if (value !== undefined && (!author || value > author.value)) author = { key, value }
  }

  const terms = (result.subjects ?? []).map((x) => ` ${normalizeTerm(x)} `)
  // The candidate's genres, so a "Krimi" category matches "Detective and mystery stories".
  const genres = new Set((result.subjects ?? []).flatMap(genresOfSubject))
  let subjectSum = 0
  let subject: Score['subject']
  for (const [key, value, genre] of s.subjects) {
    if (!(genre && genres.has(genre)) && !terms.some((t) => t.includes(` ${key} `))) continue
    subjectSum += value
    if (!subject || value > subject.value) subject = { key, value }
  }

  const decade = result.firstPublishYear === undefined ? 0 : (s.decades.get(Math.floor(result.firstPublishYear / 10) * 10) ?? 0)
  const band = lengthBand(result.medianPageCount)
  const length = band ? (s.lengths.get(band) ?? 0) : 0
  const language = Math.max(0, ...result.languages.map((l) => s.languages.get(l) ?? 0))
  const popularity = Math.log10(1 + result.editionCount) / 3

  const total = 1.2 * (author?.value ?? 0) + Math.max(-1, Math.min(1.5, subjectSum)) + 0.3 * decade + 0.3 * length + 0.2 * language + 0.2 * popularity
  return { total, author, subject }
}

/** Box sets and omnibus editions ("A / B / C") make poor picks. */
function isCompilation(title: string): boolean {
  return title.includes(' / ') || title.length > 90 || /^(works|collected works|complete works)\b/i.test(title) || /\b(box(ed)? set|collection\/set|omnibus)\b|\[/i.test(title)
}

/**
 * Ranks the search hits against the profile. Books already in the library,
 * dismissed ones, compilations and poor fits are left out, and no author
 * gets more than two of the picks.
 */
export function rankCandidates(
  profile: TasteProfile,
  candidates: readonly Candidate[],
  { dismissed = new Set<string>(), limit = 12, seriesNext = new Map() as SeriesNext } = {},
): Recommendation[] {
  const s = scalesFor(profile)
  const seen = new Set<string>()
  const scored: Recommendation[] = []
  for (const { result } of candidates) {
    const key = bookKey(result.title, result.authors[0]?.name)
    if (!result.title || result.authors.length === 0 || isCompilation(result.title)) continue
    if (seen.has(result.work.id) || seen.has(key)) continue
    seen.add(result.work.id)
    seen.add(key)
    const owned = profile.owned.workIds.has(result.work.id) || result.authors.some((a) => profile.owned.keys.has(bookKey(result.title, a.name)))
    if (owned || dismissed.has(result.work.id)) continue

    const score = scoreCandidate(result, s)
    // The next book of a series the reader is part-way through goes first, whatever else it scores.
    const next = seriesNext.get(result.work.id)
    if (next) {
      scored.push({ result, score: score.total + 10, reason: { kind: 'series', series: next.series, position: next.position } })
      continue
    }
    // A pick needs a reason: a liked author or a liked subject, not just era, length or popularity.
    const fits = (score.author?.value ?? 0) > 0 || (score.subject?.value ?? 0) > 0
    if (!fits || score.total <= 0.15) continue
    scored.push({ result, score: score.total, reason: reasonFor(profile, score) })
  }

  scored.sort((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title))
  const perAuthor = new Map<string, number>()
  const picks: Recommendation[] = []
  for (const r of scored) {
    const author = normalizeTerm(r.result.authors[0]!.name)
    const n = perAuthor.get(author) ?? 0
    // Series picks don't count toward the two-per-author cap.
    if (r.reason.kind !== 'series') {
      if (n >= 2) continue
      perAuthor.set(author, n + 1)
    }
    picks.push(r)
    if (picks.length === limit) break
  }
  return picks
}

function reasonFor(profile: TasteProfile, score: Score): Reason {
  const author = score.author && score.author.value > 0 ? profile.authors.get(score.author.key) : undefined
  const subject = score.subject && score.subject.value > 0 ? profile.subjects.get(score.subject.key) : undefined
  if (author && score.author!.value * 1.2 >= (score.subject?.value ?? 0)) return { kind: 'author', author: author.label, book: author.loved?.title }
  if (author && !subject) return { kind: 'author', author: author.label, book: author.loved?.title }
  return { kind: 'subject', subject: subject!.label, book: subject!.loved?.title }
}
