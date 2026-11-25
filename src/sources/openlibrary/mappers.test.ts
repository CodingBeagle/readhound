import {
  coverUrl,
  editionLanguage,
  firstCoverId,
  isNoise,
  mapSearchDoc,
  normalizeText,
  olid,
  parsePublishYear,
  workAuthorKeys,
} from './mappers'

describe('Open Library field mapping', () => {
  it('keeps only the OLID part of keys', () => {
    expect(olid('/works/OL21745884W')).toBe('OL21745884W')
    expect(olid('/books/OL30036715M')).toBe('OL30036715M')
  })

  it('maps edition languages to their code', () => {
    expect(editionLanguage([{ key: '/languages/dan' }])).toBe('dan')
    expect(editionLanguage(undefined)).toBeUndefined()
  })

  it('normalises string and {type, value} descriptions', () => {
    expect(normalizeText('Plain')).toBe('Plain')
    expect(normalizeText({ type: '/type/text', value: ' Typed ' })).toBe('Typed')
    expect(normalizeText('   ')).toBeUndefined()
  })

  it('uses the first positive cover ID', () => {
    expect(firstCoverId([-1, 0, 42, 7])).toBe(42)
    expect(firstCoverId([])).toBeUndefined()
    expect(coverUrl(42, 'L')).toBe('https://covers.openlibrary.org/b/id/42-L.jpg')
  })

  it('parses the first 4-digit year from free-text dates', () => {
    expect(parsePublishYear('May 04, 2021')).toBe(2021)
    expect(parsePublishYear('2015-12-11')).toBe(2015)
    expect(parsePublishYear('2000')).toBe(2000)
    expect(parsePublishYear('c. 1992?')).toBe(1992)
    expect(parsePublishYear('n.d.')).toBeUndefined()
  })

  it('reads author keys from both work author shapes', () => {
    expect(workAuthorKeys({ key: '/works/W', authors: [{ author: { key: '/authors/A' } }, { key: '/authors/B' }] })).toEqual([
      '/authors/A',
      '/authors/B',
    ])
  })

  it('flags summary and study-guide titles as noise', () => {
    expect(isNoise('Summary of Andy Weir’s Project Hail Mary')).toBe(true)
    expect(isNoise('SUMMARY and REVIEW : PROJECT HAIL MARY')).toBe(true)
    expect(isNoise('Summary and Analysis of X')).toBe(true)
    expect(isNoise('Study Guide: X')).toBe(true)
    expect(isNoise('Project Hail Mary')).toBe(false)
  })

  it('maps a search doc', () => {
    expect(
      mapSearchDoc({
        key: '/works/OL1W',
        title: 'T',
        author_key: ['OL1A'],
        author_name: ['Name'],
        edition_count: 3,
        cover_i: -1,
      }),
    ).toEqual({
      work: { source: 'openlibrary', id: 'OL1W' },
      title: 'T',
      authors: [{ ref: { source: 'openlibrary', id: 'OL1A' }, name: 'Name' }],
      firstPublishYear: undefined,
      editionCount: 3,
      medianPageCount: undefined,
      coverUrl: undefined,
      languages: [],
    })
  })
})
