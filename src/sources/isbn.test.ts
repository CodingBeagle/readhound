import { isbn10To13, isValidIsbn10, isValidIsbn13, normalizeIsbn, parseIsbn } from './isbn'

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
})
