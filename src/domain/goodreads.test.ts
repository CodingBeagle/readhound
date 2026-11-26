import SAMPLE from './__fixtures__/goodreads_library_export.csv?raw'
import { parseCsv } from './csv'
import { cleanIsbn, formatFromBinding, GoodreadsError, importCounts, parseGoodreadsCsv, parseGoodreadsDate, readsFor, reviewText, shelfToListName, splitSeries } from './goodreads'

describe('parseCsv', () => {
  it('reads quotes, doubled quotes, commas and line breaks inside cells, and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi""\nthere"\n\n1,\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
      ['1', ''],
    ])
  })
})

describe('Goodreads fields', () => {
  it('strips the ="…" spreadsheet quoting from ISBNs and checks them', () => {
    expect(cleanIsbn('="0593135202"')).toBe('0593135202')
    expect(cleanIsbn('="9780593135204"')).toBe('9780593135204')
    expect(cleanIsbn('=""')).toBeUndefined()
    expect(cleanIsbn('="9780593135205"')).toBeUndefined()
  })

  it('maps bindings to formats', () => {
    expect(formatFromBinding('Kindle Edition')).toBe('ebook')
    expect(formatFromBinding('Audible Audio')).toBe('audiobook')
    expect(formatFromBinding('Mass Market Paperback')).toBe('paperback')
    expect(formatFromBinding('Hardcover')).toBe('hardcover')
    expect(formatFromBinding('Leather Bound')).toBe('other')
    expect(formatFromBinding('')).toBeUndefined()
  })

  it('parses dates, series suffixes, shelf names and reviews', () => {
    expect(parseGoodreadsDate('2024/3/7')).toBe('2024-03-07')
    expect(parseGoodreadsDate('soon')).toBeUndefined()
    expect(splitSeries('The Way of Kings (The Stormlight Archive, #1)')).toEqual({ title: 'The Way of Kings', series: { name: 'The Stormlight Archive', position: 1 } })
    expect(splitSeries('Edgedancer (The Stormlight Archive #2.5)').series).toEqual({ name: 'The Stormlight Archive', position: 2.5 })
    expect(splitSeries('Good Omens').series).toBeUndefined()
    expect(shelfToListName('summer-reading_2024')).toBe('Summer reading 2024')
    expect(reviewText('One<br/><br/><br/>Two &amp; <i>three</i>')).toBe('One\n\nTwo & three')
  })
})

describe('readsFor', () => {
  const base = { addedOn: '2024-01-01', readCount: 0 }
  it('gives a finished book a read on Date Read, else Date Added', () => {
    expect(readsFor({ ...base, status: 'finished', dateRead: '2024-02-10' })).toEqual([{ startedOn: '2024-02-10', endedOn: '2024-02-10', outcome: 'finished', startUnknown: true }])
    expect(readsFor({ ...base, status: 'finished' })).toEqual([{ startedOn: '2024-01-01', endedOn: '2024-01-01', outcome: 'finished', startUnknown: true }])
  })

  it('turns Read Count into rereads, the earlier ones on Date Added', () => {
    const reads = readsFor({ ...base, status: 'finished', dateRead: '2024-02-10', readCount: 3 })
    expect(reads.map((r) => r.endedOn)).toEqual(['2024-01-01', '2024-01-01', '2024-02-10'])
  })

  it('uses Date Started when the export has it', () => {
    expect(readsFor({ ...base, status: 'finished', dateRead: '2024-02-10', dateStarted: '2024-02-01' })[0]).toMatchObject({ startedOn: '2024-02-01', startUnknown: false })
  })

  it('opens a read for currently reading, after any earlier finished read', () => {
    expect(readsFor({ ...base, status: 'reading', readCount: 1 })).toEqual([{ startedOn: '2024-01-01', startUnknown: true }])
    const reread = readsFor({ ...base, status: 'reading', dateRead: '2024-03-01', readCount: 2 })
    expect(reread).toHaveLength(2)
    expect(reread[0]).toMatchObject({ outcome: 'finished', endedOn: '2024-03-01' })
    expect(reread[1]).toMatchObject({ startedOn: '2024-03-01' })
    expect(reread[1]!.outcome).toBeUndefined()
  })

  it('closes a DNF read on Date Read', () => {
    expect(readsFor({ ...base, status: 'dnf', dateRead: '2024-06-01' })).toEqual([{ startedOn: '2024-01-01', endedOn: '2024-06-01', outcome: 'dnf', startUnknown: true }])
  })

  it('gives to-read books no reads', () => {
    expect(readsFor({ ...base, status: 'to_read' })).toEqual([])
  })
})

describe('parseGoodreadsCsv', () => {
  const { books, skippedRows } = parseGoodreadsCsv(SAMPLE, '2026-11-26')
  const byTitle = (title: string) => books.find((b) => b.title === title)!

  it('reads every row of the sample export', () => {
    expect(books).toHaveLength(7)
    expect(skippedRows).toEqual([])
  })

  it('maps a finished, rated, owned favourite with a review and a reread', () => {
    expect(byTitle('Project Hail Mary')).toMatchObject({
      isbn13: '9780593135204',
      isbn10: '0593135202',
      status: 'finished',
      rating: 5,
      format: 'hardcover',
      pageCount: 476,
      owned: true,
      favourite: true,
      genres: ['scifi'],
      lists: [],
      addedOn: '2024-02-01',
      review: 'Loved every page.\n\nRocky is the best.',
    })
    expect(byTitle('Project Hail Mary').reads).toHaveLength(2)
  })

  it('maps shelves to statuses, genres and lists', () => {
    expect(byTitle('The Way of Kings')).toMatchObject({ status: 'reading', format: 'ebook', rating: undefined, genres: ['fantasy'], series: { name: 'The Stormlight Archive', position: 1 } })
    expect(byTitle('Kongens Fald')).toMatchObject({ status: 'to_read', owned: true, lists: ['Danske klassikere', 'Summer 2026'], reads: [] })
    expect(byTitle('The Silmarillion')).toMatchObject({ status: 'dnf', authors: ['J.R.R. Tolkien', 'Christopher Tolkien'], privateNotes: 'Too dense for a summer holiday.', firstPublishYear: 1977 })
    expect(byTitle('Frøken Smillas fornemmelse for sne')).toMatchObject({ genres: ['crime'], lists: ['Danske klassikere'] })
    expect(byTitle("Assassin's Apprentice")).toMatchObject({ owned: true, reads: [{ endedOn: '2022-08-14', outcome: 'finished' }] })
  })

  it('counts what the preview shows', () => {
    expect(importCounts(books)).toMatchObject({
      books: 7,
      byStatus: { to_read: 1, reading: 1, finished: 4, dnf: 1 },
      finishedReads: 5,
      rereads: 1,
      rated: 5,
      owned: 3,
      reviews: 2,
      withIsbn: 3,
      lists: ['Danske klassikere', 'Summer 2026'],
    })
  })

  it('rejects files that are not a Goodreads export', () => {
    expect(() => parseGoodreadsCsv('Title,Author\nX,Y\n', '2026-11-26')).toThrow(GoodreadsError)
  })
})
