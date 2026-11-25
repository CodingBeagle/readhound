import type { EditionDetails } from '@/sources/types'

export const DEFAULT_PREFERRED_LANGUAGES = ['dan', 'eng']

/** Edition picker order: preferred languages first (in preference order), then newest first. */
export function orderEditions(editions: readonly EditionDetails[], preferred: readonly string[]): EditionDetails[] {
  const rank = (e: EditionDetails) => {
    const i = e.language ? preferred.indexOf(e.language) : -1
    return i === -1 ? preferred.length : i
  }
  return [...editions].sort((a, b) => rank(a) - rank(b) || (b.publishYear ?? 0) - (a.publishYear ?? 0))
}

/**
 * The edition a one-tap add picks: the picker's first choice, preferring one
 * with a page count and a cover among editions in that same language.
 */
export function pickEdition(editions: readonly EditionDetails[], preferred: readonly string[]): EditionDetails | undefined {
  const ordered = orderEditions(editions, preferred)
  const first = ordered[0]
  if (!first) return undefined
  const same = ordered.filter((e) => e.language === first.language)
  const quality = (e: EditionDetails) => (e.pageCount ? 2 : 0) + (e.coverUrl ? 1 : 0)
  return same.reduce((best, e) => (quality(e) > quality(best) ? e : best), first)
}
