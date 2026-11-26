import { QUOTE_DATA } from '@/domain/quoteData'

import { landing } from './copy'

describe('landing page copy', () => {
  it('only shows quotes from the verified quote book, word for word', () => {
    for (const q of landing.quotes) {
      const match = QUOTE_DATA.quotes.find((quote) => quote.text === q.text)
      expect(match, q.text).toBeDefined()
      const book = QUOTE_DATA.books[match!.book]!
      expect(q.source).toBe(`${book.author}, ${book.title}`)
    }
  })
})
