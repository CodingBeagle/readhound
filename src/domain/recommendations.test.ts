import searchWeir from '@/sources/openlibrary/__fixtures__/search-author-andy-weir.json'
import searchSciFi from '@/sources/openlibrary/__fixtures__/search-subject-science-fiction.json'
import { mapSearchResponse, type OlSearchResponse } from '@/sources/openlibrary/mappers'

import { bookKey, bookWeight, normalizeTerm, rankCandidates, seedsFor, tasteProfile, usefulSubject, type Candidate, type Seed } from './recommendations'
import { buildStatsModel } from './stats'
import type { Author, Category, Edition, LibraryEntry, Read, Work } from './types'

const authors: Author[] = [
  { id: 'a1', name: 'Andy Weir', overrides: {} },
  { id: 'a2', name: 'Peter Høeg', overrides: {} },
  { id: 'a3', name: 'Dan Brown', overrides: {} },
]
const categories: Category[] = [
  { id: 'sf', name: 'Science fiction', kind: 'genre', isFiction: true },
  { id: 'crime', name: 'Krimi', kind: 'genre', isFiction: true },
]
const work = (id: string, title: string, authorId: string, year: number, subjects: string[] = [], ol?: string): Work => ({
  id,
  title,
  authorIds: [authorId],
  firstPublishYear: year,
  subjects,
  ...(ol && { sourceRef: { source: 'openlibrary' as const, id: ol } }),
})
const works = [
  work('w1', 'Project Hail Mary', 'a1', 2021, ['Science-Fiction', 'Space flight', 'nyt:hardcover-fiction=2021-05-23', 'Fiction'], 'OL21745884W'),
  work('w2', 'Frøken Smillas fornemmelse for sne', 'a2', 1992, ['Detective and mystery stories']),
  work('w3', 'Da Vinci-mysteriet', 'a3', 2003, ['Thrillers']),
  work('w4', 'Some book to read', 'a3', 2010),
]
const edition = (id: string, workId: string, pageCount: number, language = 'eng'): Edition => ({
  id,
  workId,
  title: works.find((w) => w.id === workId)!.title,
  pageCount,
  language,
  borrowed: {},
  overrides: {},
})
const editions = [edition('e1', 'w1', 496), edition('e2', 'w2', 410, 'dan'), edition('e3', 'w3', 520, 'dan'), edition('e4', 'w4', 300)]
const entry = (id: string, editionId: string, status: LibraryEntry['status'], rating?: number, categoryIds: string[] = [], favourite = false): LibraryEntry => ({
  id,
  editionId,
  status,
  rating,
  categoryIds,
  favourite,
  addedAt: '2026-01-01T10:00:00Z',
  statusChangedAt: '2026-01-01T10:00:00Z',
})
const entries = [
  entry('n1', 'e1', 'finished', 5, ['sf']),
  entry('n2', 'e2', 'finished', 4, ['crime']),
  entry('n3', 'e3', 'dnf', 1, ['crime']),
  entry('n4', 'e4', 'to_read'),
]
const reads: Read[] = [
  { id: 'r1', entryId: 'n1', startedOn: '2026-01-01', endedOn: '2026-01-20', outcome: 'finished' },
  { id: 'r2', entryId: 'n2', startedOn: '2026-02-01', endedOn: '2026-02-20', outcome: 'finished' },
  { id: 'r3', entryId: 'n3', startedOn: '2026-03-01', endedOn: '2026-03-05', outcome: 'dnf' },
]
const model = buildStatsModel({ entries, editions, works, authors, reads, sessions: [], categories })

const results = (r: unknown) => mapSearchResponse(r as OlSearchResponse)
const seed = (kind: Seed['kind'], label: string): Seed => ({ kind, label, query: {} })
const candidates: Candidate[] = [
  ...results(searchWeir).map((result) => ({ result, seed: seed('author', 'Andy Weir') })),
  ...results(searchSciFi).map((result) => ({ result, seed: seed('subject', 'Science fiction') })),
]

describe('taste profile', () => {
  it('weighs books by rating, favourites, finishes and DNFs', () => {
    const book = model.books.find((b) => b.entry.id === 'n1')!
    expect(bookWeight(book, 1)).toBe(2.5) // 5 − 2.5
    expect(bookWeight({ ...book, entry: { ...book.entry, favourite: true } }, 2)).toBe(4) // 2.5 + 1 favourite + 0.5 reread
    expect(bookWeight({ ...book, entry: { ...book.entry, rating: undefined } }, 1)).toBe(0.5)
    expect(bookWeight({ ...book, entry: { ...book.entry, rating: undefined, status: 'dnf' } }, 0)).toBe(-1)
    expect(bookWeight({ ...book, entry: { ...book.entry, rating: undefined, status: 'to_read' } }, 0)).toBe(0)
  })

  it('learns authors, genres, subjects, decades, lengths and languages', () => {
    const p = tasteProfile(model)
    expect(p.signals).toBe(3) // the to-read book says nothing
    expect(p.authors.get('andy weir')).toMatchObject({ score: 2.5, loved: { title: 'Project Hail Mary' } })
    expect(p.authors.get('dan brown')!.score).toBe(-1.5)
    // Genre counts fully, the matching source subject is merged into it; other subjects count half.
    expect(p.subjects.get('science fiction')!.score).toBe(2.5)
    expect(p.subjects.get('space flight')!.score).toBe(1.25)
    expect(p.subjects.has('fiction')).toBe(false) // stoplist
    expect(p.subjects.get('krimi')!.score).toBe(1.5 - 1.5) // 4 − 2.5, then 1 − 2.5
    expect(p.decades.get(2020)).toBe(2.5)
    expect(p.lengths.get('long')).toBe(2.5 + 1.5 - 1.5) // 496, 410 and 520 pages
    expect(p.languages.get('dan')).toBe(0)
    expect(p.owned.workIds.has('OL21745884W')).toBe(true)
    expect(p.owned.keys.has(bookKey('Some book to read', 'Dan Brown'))).toBe(true)
  })

  it('seeds searches from the strongest liked authors and subjects only', () => {
    const seeds = seedsFor(tasteProfile(model))
    expect(seeds.map((s) => `${s.kind}:${s.label}`)).toEqual([
      'author:Andy Weir',
      'author:Peter Høeg',
      'subject:Science fiction',
      'subject:Space flight', // 2.5 / 2
      'subject:Detective and mystery stories', // 1.5 / 2
    ])
    expect(seeds[0]!.query).toMatchObject({ author: 'Andy Weir', popular: true, withSubjects: true })
    expect(seeds[2]!.query).toMatchObject({ subject: 'Science fiction' })
  })

  it('keeps tags and filler out of the subjects', () => {
    expect(usefulSubject('nyt:hardcover-fiction=2021-05-23')).toBeUndefined()
    expect(usefulSubject('Fiction')).toBeUndefined()
    expect(usefulSubject('Reading Level-Grade 11')).toBeUndefined()
    expect(usefulSubject('Hard Science-Fiction')).toBe('hard science fiction')
    expect(normalizeTerm('  Frøken  Smilla! ')).toBe('frøken smilla')
  })
})

describe('ranking', () => {
  const profile = tasteProfile(model)
  const picks = rankCandidates(profile, candidates)
  const titles = picks.map((p) => p.result.title)

  it('puts more by a loved author first and explains why', () => {
    expect(titles.slice(0, 2)).toEqual(['The Martian', 'Artemis'])
    expect(picks[0]!.reason).toEqual({ kind: 'author', author: 'Andy Weir', book: 'Project Hail Mary' })
  })

  it('leaves out owned books, compilations and a third book by one author', () => {
    expect(titles).not.toContain('Project Hail Mary')
    expect(titles.some((t) => t.includes(' / '))).toBe(false)
    expect(picks.filter((p) => p.result.authors[0]!.name === 'Andy Weir')).toHaveLength(2)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('fills up with matching subjects, each with a reason', () => {
    const sf = picks.find((p) => p.result.title === 'Dune')!
    expect(sf.reason).toEqual({ kind: 'subject', subject: 'Science fiction', book: 'Project Hail Mary' })
    expect(picks.length).toBeGreaterThan(4)
    expect(picks.length).toBeLessThanOrEqual(12)
    for (let i = 1; i < picks.length; i++) expect(picks[i - 1]!.score).toBeGreaterThanOrEqual(picks[i]!.score)
  })

  it('drops dismissed books', () => {
    const martian = picks[0]!.result.work.id
    const again = rankCandidates(profile, candidates, { dismissed: new Set([martian]) })
    expect(again.map((p) => p.result.work.id)).not.toContain(martian)
  })
})

describe('owned and compilations', () => {
  it('spots an owned book under any of its authors and skips box sets', () => {
    const profile = tasteProfile(model)
    const fake = (title: string, names: string[], id: string): Candidate => ({
      result: { work: { source: 'openlibrary', id }, title, authors: names.map((name, i) => ({ ref: { source: 'openlibrary', id: `A${i}` }, name })), editionCount: 5, languages: [] },
      seed: seed('author', 'Andy Weir'),
    })
    const picks = rankCandidates(profile, [
      fake('Project Hail Mary: a novel', ['Someone Else', 'Andy Weir'], 'X1'),
      fake('The Andy Weir Box Set', ['Andy Weir'], 'X2'),
      fake('Weir Collection [collection/set]', ['Andy Weir'], 'X3'),
      fake('A New Weir Book', ['Andy Weir'], 'X4'),
    ])
    expect(picks.map((p) => p.result.title)).toEqual(['A New Weir Book'])
  })
})
