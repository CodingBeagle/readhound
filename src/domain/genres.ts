/**
 * Genre suggestions (design doc, Genres).
 *
 * Catalog subjects are messy ("Fiction, fantasy, epic", "Detective and
 * mystery stories", "FICTION / Thrillers / Suspense"), so they are mapped onto
 * a fixed list of about 30 clean genres. Evidence comes from several places,
 * each with its own weight:
 *
 * - subjects of the work and of every edition of it (Open Library),
 * - the work's genre on Wikidata (P136), which is usually cleaner,
 * - genres the reader gave other books in the same series, or by the same author,
 * - what the reader taught the app by correcting earlier suggestions.
 *
 * Everything here is pure. Gathering the evidence is in `db/genres.ts`.
 */
import { normalizeTerm, usefulSubject } from './recommendations'

export type GenreId =
  | 'fantasy'
  | 'scifi'
  | 'horror'
  | 'crime'
  | 'thriller'
  | 'romance'
  | 'historical'
  | 'literary'
  | 'classics'
  | 'ya'
  | 'children'
  | 'graphic'
  | 'humour'
  | 'short'
  | 'poetry'
  | 'drama'
  | 'biography'
  | 'history'
  | 'science'
  | 'philosophy'
  | 'psychology'
  | 'selfhelp'
  | 'business'
  | 'politics'
  | 'truecrime'
  | 'travel'
  | 'nature'
  | 'religion'
  | 'art'
  | 'food'
  | 'health'

export interface Genre {
  id: GenreId
  /** The category name used when the reader has no category for it yet. */
  name: string
  isFiction: boolean
  /** Phrases that point to the genre when found as whole words in a subject. */
  patterns: string[]
  /** Other names a reader's own category might have, Danish included. */
  aliases: string[]
  /** Open Library subject key for finding more books in the genre (recommendations). */
  olSubject: string
}

const g = (id: GenreId, name: string, isFiction: boolean, olSubject: string, patterns: string[], aliases: string[] = []): Genre => ({
  id,
  name,
  isFiction,
  olSubject,
  patterns,
  aliases,
})

/** The fixed list. Order is the display order for ties. */
export const GENRES: readonly Genre[] = [
  g(
    'fantasy',
    'Fantasy',
    true,
    'fantasy',
    ['fantasy', 'fantasy fiction', 'epic fantasy', 'high fantasy', 'urban fantasy', 'sword and sorcery', 'dragons', 'wizards', 'magic', 'elves'],
    ['fantasy'],
  ),
  g(
    'scifi',
    'Science fiction',
    true,
    'science_fiction',
    [
      'science fiction',
      'sci fi',
      'scifi',
      'space opera',
      'cyberpunk',
      'dystopias',
      'dystopian',
      'dystopian fiction',
      'time travel',
      'speculative fiction',
      'extraterrestrial',
      'life on other planets',
      'space warfare',
      'interplanetary voyages',
    ],
    ['sci fi', 'scifi', 'sf'],
  ),
  g(
    'horror',
    'Horror',
    true,
    'horror',
    ['horror', 'horror fiction', 'horror tales', 'ghost stories', 'vampires', 'zombies', 'gothic fiction', 'supernatural fiction', 'occult fiction'],
    ['gys', 'gyser'],
  ),
  g(
    'crime',
    'Crime & mystery',
    true,
    'mystery_and_detective_stories',
    [
      'detective and mystery stories',
      'detective fiction',
      'mystery fiction',
      'mystery',
      'mysteries',
      'crime fiction',
      'crime novel',
      'detective',
      'detectives',
      'police procedural',
      'murder',
      'whodunit',
      'krimi',
      'kriminalromaner',
      'nordic noir',
      'private investigators',
    ],
    ['krimi', 'krimier', 'crime', 'mystery', 'crime fiction', 'krimi og spænding'],
  ),
  g(
    'thriller',
    'Thriller',
    true,
    'thrillers',
    ['thriller', 'thrillers', 'suspense', 'suspense fiction', 'spy stories', 'espionage', 'spy fiction', 'psychological thriller', 'spændingsromaner'],
    ['thrillers', 'spænding', 'suspense'],
  ),
  g('romance', 'Romance', true, 'romance', ['romance', 'romance fiction', 'love stories', 'romantic fiction', 'romantic comedy', 'kærlighedsromaner'], ['romantik', 'kærlighed']),
  g(
    'historical',
    'Historical fiction',
    true,
    'historical_fiction',
    ['historical fiction', 'fiction historical', 'historical novel', 'historical novels', 'historiske romaner'],
    ['historiske romaner', 'historisk roman', 'historical'],
  ),
  g(
    'literary',
    'Literary fiction',
    true,
    'literary_fiction',
    ['literary fiction', 'fiction literary', 'psychological fiction', 'domestic fiction', 'bildungsroman', 'family saga', 'satire', 'skønlitteratur', 'psychological novel'],
    ['literary', 'skønlitteratur', 'litterær fiktion', 'romaner', 'fiction'],
  ),
  g('classics', 'Classics', true, 'classic_literature', ['classic literature', 'classics', 'classic fiction', 'literary classics'], ['klassiker', 'klassikere', 'classic']),
  g(
    'ya',
    'Young adult',
    true,
    'young_adult_fiction',
    ['young adult', 'young adult fiction', 'teen fiction', 'teenagers', 'coming of age'],
    ['ya', 'ungdom', 'ungdomsbøger', 'ungdomsroman'],
  ),
  g(
    'children',
    "Children's",
    true,
    'juvenile_fiction',
    ["children's fiction", 'children s fiction', 'children s literature', 'children s stories', 'juvenile fiction', 'juvenile literature', 'picture books', 'børnebøger'],
    ['børnebøger', 'børn', 'children', 'kids'],
  ),
  g(
    'graphic',
    'Graphic novels & comics',
    true,
    'graphic_novels',
    ['graphic novels', 'graphic novel', 'comic books strips etc', 'comic books', 'comic strip', 'comic strips', 'comics', 'manga', 'tegneserier'],
    ['tegneserier', 'tegneserie', 'comics', 'graphic novels', 'manga'],
  ),
  g(
    'humour',
    'Humour',
    true,
    'humor',
    ['humor', 'humour', 'humorous fiction', 'humorous stories', 'comedy', 'wit and humor', 'comic fiction', 'comic novel', 'comic science fiction', 'comic fantasy'],
    ['humor'],
  ),
  g('short', 'Short stories', true, 'short_stories', ['short stories', 'short story', 'noveller'], ['noveller', 'novellesamling']),
  g('poetry', 'Poetry', true, 'poetry', ['poetry', 'poems', 'poem', 'digte', 'lyrik', 'verse'], ['digte', 'lyrik', 'poesi']),
  g('drama', 'Drama & plays', true, 'plays', ['drama', 'plays', 'play', 'tragedies', 'comedies', 'skuespil'], ['skuespil', 'dramatik', 'plays']),
  g(
    'biography',
    'Biography & memoir',
    false,
    'biography',
    ['biography', 'biographies', 'autobiography', 'memoir', 'memoirs', 'autobiographies', 'biografier', 'erindringer', 'diaries', 'letters', 'personal narratives'],
    ['biografi', 'biografier', 'erindringer', 'memoir', 'memoirs', 'selvbiografi', 'biography'],
  ),
  g(
    'history',
    'History',
    false,
    'history',
    ['history', 'military history', 'world history', 'ancient history', 'historie', 'world war 1939 1945', 'world war 1914 1918'],
    ['historie'],
  ),
  g(
    'science',
    'Popular science',
    false,
    'popular_science',
    [
      'popular science',
      'popular works',
      'science',
      'physics',
      'astronomy',
      'biology',
      'evolution',
      'cosmology',
      'mathematics',
      'chemistry',
      'neuroscience',
      'genetics',
      'populærvidenskab',
    ],
    ['populærvidenskab', 'science', 'videnskab'],
  ),
  g('philosophy', 'Philosophy', false, 'philosophy', ['philosophy', 'ethics', 'existentialism', 'stoicism', 'filosofi'], ['filosofi']),
  g('psychology', 'Psychology', false, 'psychology', ['psychology', 'cognitive psychology', 'social psychology', 'behavior', 'psykologi'], ['psykologi']),
  g(
    'selfhelp',
    'Self-help',
    false,
    'self-help',
    ['self help', 'self help techniques', 'personal development', 'success', 'self actualization', 'conduct of life', 'motivation', 'habits', 'selvhjælp', 'personlig udvikling'],
    ['selvhjælp', 'self help', 'personlig udvikling'],
  ),
  g(
    'business',
    'Business & economics',
    false,
    'business',
    ['business', 'economics', 'management', 'leadership', 'entrepreneurship', 'finance', 'investing', 'marketing', 'økonomi', 'erhverv'],
    ['økonomi', 'erhverv', 'business'],
  ),
  g(
    'politics',
    'Politics & society',
    false,
    'political_science',
    ['politics', 'political science', 'politics and government', 'social conditions', 'sociology', 'social science', 'feminism', 'current affairs', 'politik', 'samfund'],
    ['politik', 'samfund', 'society'],
  ),
  g('truecrime', 'True crime', false, 'true_crime', ['true crime', 'criminals', 'crime case studies', 'serial murderers', 'murder case studies'], ['true crime']),
  g('travel', 'Travel', false, 'travel', ['travel', 'description and travel', 'voyages and travels', 'travel writing', 'rejser', 'rejsebeskrivelser'], ['rejser', 'rejsebøger']),
  g(
    'nature',
    'Nature & environment',
    false,
    'nature',
    ['nature', 'natural history', 'environment', 'ecology', 'climate change', 'animals', 'birds', 'natur', 'klima'],
    ['natur', 'miljø', 'klima'],
  ),
  g(
    'religion',
    'Religion & spirituality',
    false,
    'religion',
    ['religion', 'spirituality', 'christianity', 'buddhism', 'theology', 'bible', 'mythology', 'religion og tro'],
    ['religion', 'tro', 'spiritualitet'],
  ),
  g('art', 'Art & design', false, 'art', ['art', 'design', 'architecture', 'photography', 'music', 'film', 'kunst', 'arkitektur'], ['kunst', 'design', 'musik']),
  g('food', 'Food & cooking', false, 'cooking', ['cooking', 'cookbooks', 'food', 'recipes', 'baking', 'gastronomy', 'mad', 'opskrifter'], ['mad', 'kogebøger', 'madlavning']),
  g(
    'health',
    'Health & fitness',
    false,
    'health',
    ['health', 'fitness', 'nutrition', 'diet', 'exercise', 'medicine', 'mental health', 'running', 'sports', 'sundhed', 'motion', 'sport'],
    ['sundhed', 'motion', 'sport', 'sports'],
  ),
]

export const GENRE_BY_ID: ReadonlyMap<GenreId, Genre> = new Map(GENRES.map((x) => [x.id, x]))

const padded = (term: string) => ` ${term} `

/** Patterns of fiction genres also appear in non-fiction subjects ("Science", "History"); these words mark a subject as about fiction. */
const FICTION_WORDS = [' fiction ', ' novel ', ' novels ', ' stories ', ' roman ', ' romaner ', ' juvenile fiction ']
/** Subjects that look like a genre but are about something else. */
const NOT_GENRE = ['history and criticism', 'criticism and interpretation', 'study and teaching', 'in literature', 'translations into']

/** Whether a subject says the book is fiction ("Fiction", "Detective and mystery stories", "Roman"). */
export function isAboutFiction(subject: string): boolean {
  const p = padded(normalizeTerm(subject.replace(/['’]/g, ' ')))
  return p === ' fiction ' || FICTION_WORDS.some((w) => p.includes(w))
}

/** The genres one subject points to. */
export function genresOfSubject(subject: string): GenreId[] {
  const term = normalizeTerm(subject.replace(/['’]/g, ' '))
  if (!term || NOT_GENRE.some((x) => term.includes(x))) return []
  const p = padded(term)
  const aboutFiction = isAboutFiction(subject)
  const found: GenreId[] = []
  for (const genre of GENRES) {
    // A non-fiction genre never comes from a subject about fiction ("Science fiction", "Denmark -- History -- Fiction").
    if (!genre.isFiction && aboutFiction) continue
    if (genre.patterns.some((pattern) => p.includes(padded(pattern)))) found.push(genre.id)
  }
  // "Fiction, fantasy" is fantasy, not literary fiction: the generic "novel" match gives way to any specific genre.
  if (found.length > 1 && found.includes('literary') && !p.includes(' literary ') && !p.includes(' psychological ')) return found.filter((x) => x !== 'literary')
  return found
}

/** The genre a reader's own category stands for, by its name, or undefined. */
export function genreForCategory(name: string): GenreId | undefined {
  const key = normalizeTerm(name.replace(/['’]/g, ' '))
  for (const genre of GENRES) {
    if (normalizeTerm(genre.name.replace(/['’&]/g, ' ')) === key) return genre.id
    if (genre.aliases.some((a) => normalizeTerm(a) === key)) return genre.id
  }
  return undefined
}

export type GenreSource = 'subjects' | 'editions' | 'wikidata' | 'series' | 'author' | 'learned' | 'age'

export interface GenreEvidence {
  /** Subjects of the work (or the edition being added). */
  workSubjects?: readonly string[]
  /** Subjects of the other editions of the work, one list per edition. */
  editionSubjects?: readonly (readonly string[])[]
  /** Genre labels from Wikidata (P136), e.g. "science fiction novel". */
  wikidataGenres?: readonly string[]
  /** Genres the reader gave other books in the same series. */
  seriesGenres?: readonly GenreId[]
  /** Genres the reader gave other books by the same author, one list per book. */
  authorGenres?: readonly (readonly GenreId[])[]
  /** Learning terms for this book (see `learningTerms`). */
  terms?: readonly string[]
  learned?: GenreLearning
  firstPublishYear?: number
}

export interface GenreSuggestion {
  genre: GenreId
  score: number
  /** Where the evidence came from, strongest first. */
  sources: GenreSource[]
}

/** What the reader taught the app: learning term → genre → net votes (+ chosen, − removed). */
export type GenreLearning = Record<string, Partial<Record<GenreId, number>>>

const WEIGHTS = {
  subjects: 1,
  editions: 0.5,
  wikidata: 2,
  series: 2,
  author: 0.75,
  learned: 1,
} as const

/** Suggestions need this much evidence, and at least this share of the best genre's score. */
export const MIN_SCORE = 1.5
const MIN_SHARE = 0.55
const MAX_SUGGESTIONS = 3

/**
 * Scores every genre and returns the likely ones, best first: at most three,
 * each with enough evidence and not far behind the best one.
 */
export function suggestGenres(e: GenreEvidence): GenreSuggestion[] {
  const scores = new Map<GenreId, Map<GenreSource, number>>()
  const add = (genre: GenreId, source: GenreSource, value: number) => {
    const bySource = scores.get(genre) ?? new Map<GenreSource, number>()
    bySource.set(source, (bySource.get(source) ?? 0) + value)
    scores.set(genre, bySource)
  }

  // Each genre counts once per subject list, so a book with ten "fantasy" tags isn't ten times as fantastic.
  // A genre counts once per subject list, a little more when several subjects agree (up to double), so a
  // book with ten "fantasy" tags isn't ten times as fantastic. In a list that says the book is fiction, a
  // stray "History" or "Science" subject is about the setting, not the genre.
  const fromSubjects = (subjects: readonly string[], source: GenreSource, weight: number) => {
    const fiction = subjects.some(isAboutFiction)
    const counts = new Map<GenreId, number>()
    for (const genre of subjects.flatMap(genresOfSubject)) counts.set(genre, (counts.get(genre) ?? 0) + 1)
    for (const [genre, n] of counts) {
      const agreement = Math.min(2, 1 + 0.25 * (n - 1))
      add(genre, source, weight * agreement * (fiction && !GENRE_BY_ID.get(genre)!.isFiction ? 0.4 : 1))
    }
  }
  if (e.workSubjects) fromSubjects(e.workSubjects, 'subjects', WEIGHTS.subjects * 1.5)
  // Other editions: a genre most editions agree on counts more, up to three editions' worth.
  if (e.editionSubjects?.length) {
    const counts = new Map<GenreId, number>()
    for (const list of e.editionSubjects) {
      const fiction = list.some(isAboutFiction)
      for (const genre of new Set(list.flatMap(genresOfSubject))) counts.set(genre, (counts.get(genre) ?? 0) + (fiction && !GENRE_BY_ID.get(genre)!.isFiction ? 0.4 : 1))
    }
    for (const [genre, n] of counts) add(genre, 'editions', WEIGHTS.editions * Math.min(3, n))
  }
  if (e.wikidataGenres) fromSubjects(e.wikidataGenres, 'wikidata', WEIGHTS.wikidata)
  for (const genre of new Set(e.seriesGenres ?? [])) add(genre, 'series', WEIGHTS.series)
  if (e.authorGenres?.length) {
    const counts = new Map<GenreId, number>()
    for (const list of e.authorGenres) for (const genre of new Set(list)) counts.set(genre, (counts.get(genre) ?? 0) + 1)
    // Scaled by how many of the author's books share the genre: all of them → 2 × weight.
    for (const [genre, n] of counts) add(genre, 'author', WEIGHTS.author * 2 * (n / e.authorGenres.length))
  }
  if (e.learned && e.terms) {
    for (const term of e.terms) {
      for (const [genre, votes] of Object.entries(e.learned[term] ?? {}) as [GenreId, number][]) {
        if (votes) add(genre, 'learned', WEIGHTS.learned * Math.max(-3, Math.min(3, votes)))
      }
    }
  }
  // Old fiction is a classic.
  const fictionScore = [...scores].filter(([id]) => GENRE_BY_ID.get(id)?.isFiction).reduce((sum, [, s]) => sum + total(s), 0)
  if (e.firstPublishYear !== undefined && e.firstPublishYear < 1920 && fictionScore > 0) add('classics', 'age', 1.5)

  const ranked = [...scores]
    .map(([genre, bySource]) => ({
      genre,
      score: total(bySource),
      sources: [...bySource]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([s]) => s),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || GENRES.findIndex((x) => x.id === a.genre) - GENRES.findIndex((x) => x.id === b.genre))
  const best = ranked[0]?.score ?? 0
  return ranked.filter((s) => s.score >= MIN_SCORE && s.score >= best * MIN_SHARE).slice(0, MAX_SUGGESTIONS)
}

const total = (bySource: Map<GenreSource, number>) => [...bySource.values()].reduce((a, b) => a + b, 0)

/**
 * What a correction is remembered against: the book's useful subjects and
 * its authors. Books sharing them later get the corrected genres.
 */
export function learningTerms(subjects: readonly string[], authors: readonly string[]): string[] {
  const terms = new Set<string>()
  for (const s of subjects.slice(0, 30)) {
    const term = usefulSubject(s)
    if (term) terms.add(`s:${term}`)
  }
  for (const a of authors) {
    const term = normalizeTerm(a)
    if (term) terms.add(`a:${term}`)
  }
  return [...terms]
}

/** The most learning terms kept; the oldest are dropped first. */
const MAX_TERMS = 3000

/**
 * Records a choice: genres the reader picked that weren't suggested get a
 * vote up on each of the book's terms, suggested genres they removed a vote
 * down. Returns a new object; unchanged when there was nothing to learn.
 */
export function learnFromChoice(learned: GenreLearning, terms: readonly string[], suggested: Iterable<GenreId>, chosen: Iterable<GenreId>): GenreLearning {
  const s = new Set(suggested)
  const c = new Set(chosen)
  const votes: [GenreId, number][] = [
    ...[...c].filter((x) => !s.has(x)).map((x): [GenreId, number] => [x, 1]),
    ...[...s].filter((x) => !c.has(x)).map((x): [GenreId, number] => [x, -1]),
  ]
  if (votes.length === 0 || terms.length === 0) return learned
  const next: GenreLearning = { ...learned }
  for (const term of terms) {
    const row = { ...next[term] }
    for (const [genre, vote] of votes) {
      const value = (row[genre] ?? 0) + vote
      if (value === 0) delete row[genre]
      else row[genre] = Math.max(-5, Math.min(5, value))
    }
    // Re-inserting moves the term to the end, so the oldest come first when trimming.
    delete next[term]
    if (Object.keys(row).length) next[term] = row
  }
  const keys = Object.keys(next)
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_TERMS))) delete next[key]
  return next
}
