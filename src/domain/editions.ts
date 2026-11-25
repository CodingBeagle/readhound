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
