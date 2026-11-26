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

/** Settings key for the ids of the quotes shown most recently, oldest first, kept across visits. */
export const SETTING_QUOTE_HISTORY = 'buddyQuoteHistory'
/** How many shown quotes to remember: more than the whole quote book, so every quote gets its turn. */
export const QUOTE_HISTORY_SIZE = 500

/** Reads the stored history, dropping anything that is not a list of ids. */
export function parseQuoteHistory(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

/**
 * The next quote, at random: one not shown before if there is any, otherwise one
 * from the half of the pool that was shown longest ago. So a visit never replays
 * the last visit's quotes, and favourite themes with few quotes still mix them up.
 */
export function pickQuote(pool: readonly Quote[], history: readonly string[], random: () => number = Math.random): Quote | undefined {
  if (pool.length === 0) return undefined
  const lastSeen = new Map(history.map((id, i) => [id, i]))
  const fresh = pool.filter((q) => !lastSeen.has(q.id))
  const candidates = fresh.length
    ? fresh
    : [...pool].sort((a, b) => lastSeen.get(a.id)! - lastSeen.get(b.id)!).slice(0, Math.max(1, Math.floor(pool.length / 2)))
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
}

/** The history with a quote just shown added at the end. */
export function rememberQuote(history: readonly string[], id: string, size = QUOTE_HISTORY_SIZE): string[] {
  return [...history.filter((h) => h !== id), id].slice(-size)
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
