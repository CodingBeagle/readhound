/** Strips hyphens and spaces and upper-cases a trailing "x". */
export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const c = isbn[i]!
    sum += (c === 'X' ? 10 : Number(c)) * (10 - i)
  }
  return sum % 11 === 0
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
  return sum % 10 === 0
}

/**
 * Returns the normalised ISBN if `input` is a valid ISBN-10 or ISBN-13
 * (hyphens and spaces ignored, checksum checked), otherwise null.
 * Search uses this to decide whether to run an ISBN lookup first.
 */
export function parseIsbn(input: string): string | null {
  const isbn = normalizeIsbn(input.trim())
  return isValidIsbn10(isbn) || isValidIsbn13(isbn) ? isbn : null
}

/** Converts a valid ISBN-10 to its ISBN-13 form (978 prefix). */
export function isbn10To13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  return core + String((10 - (sum % 10)) % 10)
}
