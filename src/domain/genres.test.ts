import searchSciFi from '@/sources/openlibrary/__fixtures__/search-subject-science-fiction.json'
import workPhm from '@/sources/openlibrary/__fixtures__/work-OL21745884W.json'
import workSmilla from '@/sources/openlibrary/__fixtures__/work-OL258333W.json'

import { GENRES, genreForCategory, genresOfSubject, learnFromChoice, learningTerms, suggestGenres, type GenreId } from './genres'

const ids = (list: { genre: GenreId }[]) => list.map((s) => s.genre)
const docSubjects = (title: string) => (searchSciFi.docs as { title: string; subject?: string[] }[]).find((d) => d.title === title)!.subject ?? []

describe('the genre list', () => {
  it('has about 30 genres with unique ids and Open Library subjects', () => {
    expect(GENRES.length).toBeGreaterThanOrEqual(28)
    expect(GENRES.length).toBeLessThanOrEqual(32)
    expect(new Set(GENRES.map((g) => g.id)).size).toBe(GENRES.length)
    for (const g of GENRES) expect(g.olSubject).toMatch(/^[a-z_-]+$/)
  })

  it('maps messy subjects onto clean genres', () => {
    expect(genresOfSubject('Fiction, fantasy, epic')).toEqual(['fantasy'])
    expect(genresOfSubject('FICTION / Science Fiction / Hard Science Fiction')).toEqual(['scifi'])
    expect(genresOfSubject('Detective and mystery stories')).toEqual(['crime'])
    expect(genresOfSubject('FICTION / Thrillers / Suspense')).toEqual(['thriller'])
    expect(genresOfSubject('Biography & Autobiography')).toEqual(['biography'])
    expect(genresOfSubject("Children's stories")).toEqual(['children'])
    expect(genresOfSubject('crime novel')).toEqual(['crime']) // a Wikidata label: "novel" gives way to the specific genre
    expect(genresOfSubject('psychological novel')).toEqual(['literary'])
  })

  it("doesn't read genres into subjects that are about something else", () => {
    expect(genresOfSubject('Science fiction')).toEqual(['scifi']) // not Popular science
    expect(genresOfSubject('Denmark -- History -- Fiction')).toEqual([]) // a setting, not the History genre
    expect(genresOfSubject('English literature -- History and criticism')).toEqual([])
    expect(genresOfSubject('Fiction')).toEqual([])
    expect(genresOfSubject('nyt:hardcover-fiction=2021-05-23')).toEqual([])
  })

  it("finds the genre behind a reader's own category, Danish names included", () => {
    expect(genreForCategory('Krimi')).toBe('crime')
    expect(genreForCategory('Klassiker')).toBe('classics')
    expect(genreForCategory('Science fiction')).toBe('scifi')
    expect(genreForCategory('Popular science')).toBe('science')
    expect(genreForCategory('Memoir')).toBe('biography')
    expect(genreForCategory('Biography & memoir')).toBe('biography')
    expect(genreForCategory('Literary fiction')).toBe('literary')
    expect(genreForCategory('Digte')).toBe('poetry')
    expect(genreForCategory('Favourites')).toBeUndefined()
  })
})

describe('suggestions', () => {
  it('suggests from the work subjects of real Open Library records', () => {
    expect(ids(suggestGenres({ workSubjects: workPhm.subjects }))).toEqual(['scifi']) // one "Thrillers / Suspense" tag is too far behind
    expect(ids(suggestGenres({ workSubjects: workSmilla.subjects }))).toEqual(['crime', 'thriller'])
    expect(ids(suggestGenres({ workSubjects: docSubjects('Watchmen') }))).toEqual(['graphic', 'scifi'])
    expect(ids(suggestGenres({ workSubjects: docSubjects("The Hitchhiker's Guide to the Galaxy") }))).toEqual(['scifi', 'humour'])
  })

  it('says where each suggestion came from', () => {
    const [scifi] = suggestGenres({ workSubjects: ['Science fiction'], wikidataGenres: ['science fiction novel'] })
    expect(scifi).toMatchObject({ genre: 'scifi', score: 1.5 + 2, sources: ['wikidata', 'subjects'] })
  })

  it('needs enough evidence', () => {
    // One mention among the other editions isn't enough on its own…
    expect(suggestGenres({ editionSubjects: [['Horror tales'], ['Fiction'], ['Fiction']] })).toEqual([])
    // …but most editions agreeing is.
    expect(ids(suggestGenres({ editionSubjects: [['Horror tales'], ['Horror'], ['Ghost stories']] }))).toEqual(['horror'])
    expect(suggestGenres({})).toEqual([])
  })

  it('uses Wikidata alone', () => {
    expect(ids(suggestGenres({ wikidataGenres: ['detective fiction', 'novel'] }))).toEqual(['crime'])
  })

  it('falls back to the series and the author', () => {
    expect(ids(suggestGenres({ seriesGenres: ['crime', 'crime', 'thriller'] }))).toEqual(['crime', 'thriller'])
    // Two of the author's three books are fantasy: 0.75 × 2 × 2/3 = 1, too little alone…
    expect(suggestGenres({ authorGenres: [['fantasy'], ['fantasy'], ['history']] })).toEqual([])
    // …but every book by the author being fantasy is enough.
    expect(ids(suggestGenres({ authorGenres: [['fantasy'], ['fantasy']] }))).toEqual(['fantasy'])
  })

  it('treats old fiction as a classic', () => {
    expect(ids(suggestGenres({ workSubjects: ['Love stories'], firstPublishYear: 1813 }))).toEqual(['romance', 'classics'])
    expect(ids(suggestGenres({ workSubjects: ['Love stories'], firstPublishYear: 2013 }))).toEqual(['romance'])
  })

  it('damps non-fiction genres in a list that says the book is fiction', () => {
    expect(ids(suggestGenres({ workSubjects: ['Fiction', 'History', 'Love stories'] }))).toEqual(['romance'])
    expect(ids(suggestGenres({ workSubjects: ['History', 'Denmark'] }))).toEqual(['history'])
  })

  it('keeps at most three, none far behind the best', () => {
    const many = suggestGenres({ wikidataGenres: ['fantasy', 'science fiction', 'horror', 'romance'], workSubjects: ['Fantasy fiction'] })
    expect(ids(many)).toEqual(['fantasy', 'scifi', 'horror'])
  })
})

describe('learning from corrections', () => {
  const terms = learningTerms(['Detective and mystery stories', 'Fiction', 'nyt:x=1'], ['Jussi Adler-Olsen'])

  it('remembers corrections against subjects and authors', () => {
    expect(terms).toEqual(['s:detective and mystery stories', 'a:jussi adler olsen'])
    const learned = learnFromChoice({}, terms, ['crime', 'thriller'], ['crime', 'literary'])
    expect(learned['a:jussi adler olsen']).toEqual({ literary: 1, thriller: -1 })
  })

  it('applies what it learned to similar books', () => {
    let learned = learnFromChoice({}, terms, ['crime', 'thriller'], ['crime'])
    learned = learnFromChoice(learned, terms, ['crime', 'thriller'], ['crime'])
    // Another book by the author with the same subjects: thriller is now voted down below the bar.
    const again = suggestGenres({ workSubjects: ['Detective and mystery stories', 'Thrillers'], terms, learned })
    expect(ids(again)).toEqual(['crime'])
    expect(again[0]!.sources).toContain('subjects')

    // A genre the reader keeps adding gets suggested on its own.
    let nordic = learnFromChoice({}, ['a:someone'], [], ['crime'])
    nordic = learnFromChoice(nordic, ['a:someone'], [], ['crime'])
    expect(suggestGenres({ terms: ['a:someone'], learned: nordic })).toMatchObject([{ genre: 'crime', sources: ['learned'] }])
  })

  it('leaves the record alone when nothing changed', () => {
    const learned = {}
    expect(learnFromChoice(learned, terms, ['crime'], ['crime'])).toBe(learned)
  })
})
