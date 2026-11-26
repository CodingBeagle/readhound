/** Types for the beagle's quote book; kept free of imports so scripts/verify-quotes.ts can load the data in Node. */
export const QUOTE_THEMES = [
  'wisdom',
  'love',
  'grief',
  'courage',
  'hope',
  'happiness',
  'friendship',
  'kindness',
  'nature',
  'time',
  'reading',
  'humour',
  'adventure',
] as const
export type QuoteTheme = (typeof QUOTE_THEMES)[number]

export interface QuoteBook {
  title: string
  author: string
  /** First published; negative for BC. */
  year: number
  /** For translations: the (public-domain) translator whose words are quoted. */
  translator?: string
  /** Project Gutenberg ebook number of the text the quote was checked against. */
  gutenberg: number
}

export interface Quote {
  id: string
  /** Key into QuoteData.books. */
  book: string
  themes: QuoteTheme[]
  /** Verbatim from the book; ‘…’ marks a cut. */
  text: string
}

export interface QuoteData {
  books: Record<string, QuoteBook>
  quotes: Quote[]
}
