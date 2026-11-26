import { QUOTE_DATA } from './quoteData'
import {
  bookInLibrary,
  isQuoteTurn,
  parseQuoteSettings,
  QUOTE_THEMES,
  quotesFor,
  quoteTheme,
  shuffledQuotes,
  type QuoteData,
} from './quotes'
import type { StatBook } from './stats/model'

describe('the quote book', () => {
  const { books, quotes } = QUOTE_DATA

  it('has a few hundred quotes with unique ids, known books and known themes', () => {
    expect(quotes.length).toBeGreaterThanOrEqual(300)
    expect(new Set(quotes.map((q) => q.id)).size).toBe(quotes.length)
    for (const q of quotes) {
      expect(books[q.book], q.id).toBeDefined()
      expect(q.themes.length, q.id).toBeGreaterThan(0)
      for (const t of q.themes) expect(QUOTE_THEMES, q.id).toContain(t)
    }
  })

  it('has no quote twice', () => {
    const fold = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '')
    expect(new Set(quotes.map((q) => fold(q.text))).size).toBe(quotes.length)
  })

  it('gives every theme enough quotes to pick from', () => {
    for (const theme of QUOTE_THEMES) expect(quotesFor(QUOTE_DATA, [theme]).length, theme).toBeGreaterThanOrEqual(15)
  })

  it('uses every book it lists, each a public-domain text on Project Gutenberg', () => {
    const used = new Set(quotes.map((q) => q.book))
    for (const [key, book] of Object.entries(books)) {
      expect(used.has(key), key).toBe(true)
      expect(book.gutenberg).toBeGreaterThan(0)
      // Published before 1929 and by authors (and translators) long gone: public domain.
      expect(book.year, key).toBeLessThan(1929)
    }
  })

  it('writes quotes with typographic marks and tidy spacing', () => {
    for (const q of quotes) {
      expect(q.text, q.id).not.toMatch(/["']|--|\s{2}|^\s|\s$/)
      expect(q.text, q.id).toMatch(/^[A-Z‘“’(]/)
    }
  })
})

describe('quote settings', () => {
  it('defaults to quotes on with every theme', () => {
    expect(parseQuoteSettings(undefined)).toEqual({ enabled: true, themes: [] })
    expect(parseQuoteSettings('nonsense')).toEqual({ enabled: true, themes: [] })
  })

  it('keeps known themes only, in the usual order', () => {
    expect(parseQuoteSettings({ enabled: false, themes: ['hope', 'bogus', 'love'] })).toEqual({ enabled: false, themes: ['love', 'hope'] })
  })
})

const data: QuoteData = {
  books: { b: { title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, gutenberg: 1342 } },
  quotes: [
    { id: 'a', book: 'b', themes: ['love'], text: 'A.' },
    { id: 'b', book: 'b', themes: ['grief', 'hope'], text: 'B.' },
    { id: 'c', book: 'b', themes: ['wisdom'], text: 'C.' },
  ],
}

describe('picking quotes', () => {
  it('keeps quotes on any favourite theme, or all of them with none picked', () => {
    expect(quotesFor(data, []).map((q) => q.id)).toEqual(['a', 'b', 'c'])
    expect(quotesFor(data, ['hope', 'love']).map((q) => q.id)).toEqual(['a', 'b'])
  })

  it('labels a quote with the favourite theme it matched', () => {
    expect(quoteTheme(data.quotes[1]!, ['hope'])).toBe('hope')
    expect(quoteTheme(data.quotes[1]!, [])).toBe('grief')
  })

  it('shuffles the same way for the same day, and keeps every quote', () => {
    const one = shuffledQuotes(QUOTE_DATA.quotes, 42).map((q) => q.id)
    expect(shuffledQuotes(QUOTE_DATA.quotes, 42).map((q) => q.id)).toEqual(one)
    expect(shuffledQuotes(QUOTE_DATA.quotes, 43).map((q) => q.id)).not.toEqual(one)
    expect([...one].sort()).toEqual(QUOTE_DATA.quotes.map((q) => q.id).sort())
  })

  it('takes turns with the buddy’s own lines, and lets a milestone go first', () => {
    // Days whose seed is not a multiple of three open with the buddy's own line.
    expect([0, 1, 2, 3].map((n) => isQuoteTurn(n, 1, false))).toEqual([false, true, false, true])
    // The others open with a quote.
    expect([0, 1, 2, 3].map((n) => isQuoteTurn(n, 3, false))).toEqual([true, false, true, false])
    // A fresh milestone always gets the first word.
    expect([0, 1, 2, 3].map((n) => isQuoteTurn(n, 3, true))).toEqual([false, true, false, true])
  })

  it('finds the quoted book in the library by title and author', () => {
    const book = (title: string, author: string) => ({ title, authors: [{ id: 'x', name: author }] }) as StatBook
    const library = [book('Emma', 'Jane Austen'), book('Pride & Prejudice', 'Austen, Jane'), book('Pride and prejudice', 'Jane Austen')]
    expect(bookInLibrary(data.books.b!, library)).toBe(library[2])
    expect(bookInLibrary(data.books.b!, [library[0]!])).toBeUndefined()
  })
})
