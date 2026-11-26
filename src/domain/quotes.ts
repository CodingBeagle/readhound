/**
 * Book quotes from the beagle buddy (design doc, Beagle buddy > Book quotes).
 * The quotes come from public-domain books only and ship with the app, so they
 * work offline. Everything here is pure; the data itself is in quoteData.ts and
 * loaded lazily with loadQuotes().
 */
import { foldText } from './bookView'
import { QUOTE_THEMES, type QuoteData, type QuoteTheme, type Quote, type QuoteBook } from './quoteTypes'
import type { StatBook } from './stats/model'

export { QUOTE_THEMES, type Quote, type QuoteBook, type QuoteData, type QuoteTheme } from './quoteTypes'

/** Settings key for the buddy's quotes: on or off, and the favourite themes. */
export const SETTING_BUDDY_QUOTES = 'buddyQuotes'

export interface QuoteSettings {
  enabled: boolean
  /** Favourite themes; empty means every theme. */
  themes: QuoteTheme[]
}

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = { enabled: true, themes: [] }

const isTheme = (t: unknown): t is QuoteTheme => (QUOTE_THEMES as readonly unknown[]).includes(t)

/** Reads the stored setting, falling back to quotes on with every theme. */
export function parseQuoteSettings(value: unknown): QuoteSettings {
  if (!value || typeof value !== 'object') return DEFAULT_QUOTE_SETTINGS
  const v = value as Partial<Record<keyof QuoteSettings, unknown>>
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
    themes: Array.isArray(v.themes) ? QUOTE_THEMES.filter((t) => (v.themes as unknown[]).includes(t)) : [],
  }
}

/** The quote book, in its own chunk. */
export async function loadQuotes(): Promise<QuoteData> {
  return (await import('./quoteData')).QUOTE_DATA
}

/** Quotes on any of the favourite themes; every quote when none are picked. */
export function quotesFor(data: QuoteData, themes: readonly QuoteTheme[]): Quote[] {
  const wanted = themes.filter(isTheme)
  if (wanted.length === 0) return data.quotes
  return data.quotes.filter((q) => q.themes.some((t) => wanted.includes(t)))
}

/** The theme to show with a quote: the first favourite it matches, else its own first theme. */
export function quoteTheme(quote: Quote, favourites: readonly QuoteTheme[]): QuoteTheme {
  return quote.themes.find((t) => favourites.includes(t)) ?? quote.themes[0]!
}

/** A small seeded random number generator (mulberry32), so a day's order of quotes can be tested. */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The pool shuffled by a seed (the day), so the beagle goes through every quote before repeating one. */
export function shuffledQuotes(pool: readonly Quote[], seed: number): Quote[] {
  const out = [...pool]
  const next = random(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * The buddy's speech bubble takes turns: its own line, then a quote, then its own
 * line again. A fresh milestone always gets the first turn, so a cheer is never
 * pushed aside by a quote. Otherwise, on about one day in three the first thing
 * it says is a quote.
 */
export function isQuoteTurn(turn: number, daySeed: number, hasMilestone: boolean): boolean {
  const opensWithQuote = !hasMilestone && daySeed % 3 === 0
  return (turn + (opensWithQuote ? 1 : 0)) % 2 === 1
}

/** The library book a quote comes from, matched on title and author, if the reader has it. */
export function bookInLibrary(book: QuoteBook, books: readonly StatBook[]): StatBook | undefined {
  const title = simple(book.title)
  const surname = simple(book.author.split(' ').at(-1) ?? '')
  return books.find((b) => simple(b.title) === title && b.authors.some((a) => simple(a.name).includes(surname)))
}

const simple = (text: string) =>
  foldText(text)
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Search text for finding the book on Open Library. */
export const quoteSearchText = (book: QuoteBook) => `${book.title} ${book.author}`
