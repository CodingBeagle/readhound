/** Normalising catalog subjects and names for matching (shared by recommendations and genres). */

const SUBJECT_STOPLIST = new Set([
  'fiction',
  'general',
  'literature',
  'novel',
  'novels',
  'roman',
  'romaner',
  'romans',
  'romans nouvelles',
  'fiction general',
  'english fiction',
  'american fiction',
  'danish fiction',
  'accessible book',
  'protected daisy',
  'in library',
  'large type books',
  'lending library',
  'new york times bestseller',
  'new york times reviewed',
  'open library staff picks',
  'translations into english',
  'long now manual for civilization',
])

/** Lower case, punctuation to spaces, single spaces ("Science-Fiction" → "science fiction"). */
export function normalizeTerm(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** A source subject worth learning from, normalised, or undefined for tags, codes and filler. */
export function usefulSubject(subject: string): string | undefined {
  if (/[:=]/.test(subject)) return undefined
  const term = normalizeTerm(subject)
  if (term.length < 3 || term.length > 40 || SUBJECT_STOPLIST.has(term) || term.startsWith('reading level')) return undefined
  return term
}
