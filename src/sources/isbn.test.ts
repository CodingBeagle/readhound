import { isbn10To13, isbnFromBarcode, isValidIsbn10, isValidIsbn13, languageFromIsbn, normalizeIsbn, parseIsbn } from './isbn'

describe('ISBN helpers', () => {
  it('normalises hyphens, spaces and a lower-case x', () => {
    expect(normalizeIsbn('978-0-593 13520-4')).toBe('9780593135204')
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X')
  })

  it('validates ISBN-13 checksums', () => {
    expect(isValidIsbn13('9780593135204')).toBe(true)
    expect(isValidIsbn13('9780593135205')).toBe(false)
    expect(isValidIsbn13('978059313520')).toBe(false)
  })

  it('validates ISBN-10 checksums, including X', () => {
    expect(isValidIsbn10('0593135202')).toBe(true)
    expect(isValidIsbn10('080442957X')).toBe(true)
    expect(isValidIsbn10('0593135203')).toBe(false)
  })

  it('parses only valid ISBNs from search text', () => {
    expect(parseIsbn(' 978-0593135204 ')).toBe('9780593135204')
    expect(parseIsbn('0593135202')).toBe('0593135202')
    expect(parseIsbn('Project Hail Mary')).toBeNull()
    expect(parseIsbn('1234567890123')).toBeNull()
  })

  it('converts ISBN-10 to ISBN-13', () => {
    expect(isbn10To13('0593135202')).toBe('9780593135204')
  })

  it('reads an ISBN from a book barcode only', () => {
    expect(isbnFromBarcode('9780593135204')).toBe('9780593135204')
    // The 5-digit price add-on, when a reader returns it joined on.
    expect(isbnFromBarcode('9788702173543 52000')).toBe('9788702173543')
    // A magazine (ISSN, 977) or a shop's own EAN is not a book.
    expect(isbnFromBarcode('9771234567898')).toBeNull()
    expect(isbnFromBarcode('5701234567899')).toBeNull()
    expect(isbnFromBarcode('9780593135205')).toBeNull()
  })

  it('guesses the language from Nordic registration groups', () => {
    expect(languageFromIsbn('9788702173543')).toBe('dan')
    expect(languageFromIsbn('8702173546')).toBe('dan')
    expect(languageFromIsbn('9780593135204')).toBeUndefined()
    expect(languageFromIsbn('9791234567896')).toBeUndefined()
  })
})
