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

/**
 * The ISBN in a scanned barcode, or null. A book's barcode is an EAN-13
 * that starts with 978 or 979 ("Bookland"); other EAN-13s (a price label,
 * a magazine's ISSN, the shop's own sticker) are not ISBNs. The 5-digit
 * price add-on some books print beside it is read separately, so any extra
 * digits after the first 13 are ignored too.
 */
export function isbnFromBarcode(rawValue: string): string | null {
  const ean = rawValue.replace(/\D/g, '').slice(0, 13)
  return /^97[89]/.test(ean) && isValidIsbn13(ean) ? ean : null
}

/** ISBN registration groups that publish in one language: Denmark, Norway, Sweden. */
const GROUP_LANGUAGES: Record<string, string> = { '87': 'dan', '82': 'nor', '91': 'swe' }

/**
 * The language a book's ISBN suggests (ISO 639-2/B), from its registration
 * group, e.g. 978-87-… is Danish. Only groups with one main language count;
 * a guess to prefill manual entry, never stored without the reader seeing it.
 */
export function languageFromIsbn(isbn: string): string | undefined {
  const core = isbn.length === 13 ? (isbn.startsWith('978') ? isbn.slice(3) : undefined) : isbn
  return core ? GROUP_LANGUAGES[core.slice(0, 2)] : undefined
}
