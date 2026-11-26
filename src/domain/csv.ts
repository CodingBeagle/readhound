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

/**
 * Minimal RFC 4180 CSV reader: quoted cells with doubled quotes, commas and
 * line breaks inside quotes, CRLF or LF line endings, and an optional byte
 * order mark. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cellText = ''
  let quoted = false
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  const endRow = () => {
    row.push(cellText)
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
    cellText = ''
  }
  for (; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cellText += '"'
          i++
        } else quoted = false
      } else cellText += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cellText)
      cellText = ''
    } else if (ch === '\n') endRow()
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      endRow()
    } else cellText += ch
  }
  if (cellText !== '' || row.length > 0) endRow()
  return rows
}
