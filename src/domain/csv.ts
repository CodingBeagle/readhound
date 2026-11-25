/** Minimal RFC 4180 CSV writer. */
export type CsvValue = string | number | boolean | undefined | null

function cell(value: CsvValue): string {
  if (value === undefined || value === null) return ''
  let text = String(value)
  // Spreadsheet apps run cells that start with these characters as formulas.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Rows to CSV text with CRLF line endings. Starts with a byte order mark so
 * Excel opens Danish letters (æ, ø, å) correctly.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
