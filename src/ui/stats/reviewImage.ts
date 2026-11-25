import type { YearInReview } from '@/domain/stats'
import { t } from '@/i18n'

import { formatNumber } from './format'

const r = t.review
const W = 1080
const H = 1350
const BG = '#1c1917'
const INK = '#fafaf9'
const MUTED = '#a8a29e'
const ACCENT = '#f59e0b'
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** Draws the year's summary as a 1080 × 1350 PNG (a portrait social-media size). */
export async function renderReviewImage(review: YearInReview): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')
  const pad = 88
  const text = (value: string, x: number, y: number, size: number, color = INK, weight = 400, maxWidth = W - pad * 2) => {
    ctx.font = `${weight} ${size}px ${FONT}`
    ctx.fillStyle = color
    ctx.fillText(fit(ctx, value, maxWidth), x, y)
  }

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = ACCENT
  ctx.fillRect(pad, pad, 96, 10)

  text(r.intro(review.year), pad, 200, 64, INK, 700)
  text('Readhound', pad, 252, 30, MUTED)

  // Big numbers
  const stats: [string, string][] = [
    [formatNumber(review.books), r.booksRead],
    [formatNumber(review.pages), r.pagesRead],
    [formatNumber(review.readingDays), r.readingDays],
  ]
  stats.forEach(([value, label], i) => {
    const x = pad + i * 310
    text(value, x, 390, 76, ACCENT, 700, 280)
    text(label, x, 436, 28, MUTED, 400, 290)
  })

  let y = 540
  const half = (W - pad * 2 - 40) / 2
  const column = (title: string, items: string[], x: number) => {
    let cy = y
    if (items.length === 0) return cy
    text(title, x, cy, 30, MUTED, 600, half)
    cy += 48
    for (const item of items) {
      text(item, x, cy, 36, INK, 400, half)
      cy += 50
    }
    return cy
  }
  const authorsEnd = column(r.topAuthors, review.topAuthors.slice(0, 3).map((a, i) => `${i + 1}. ${a.name}`), pad)
  const genresEnd = column(r.topGenres, review.topGenres.slice(0, 3).map((g, i) => `${i + 1}. ${g.name}`), pad + half + 40)
  y = Math.max(authorsEnd, genresEnd) + 40

  const highlight = (label: string, book: { title: string } | undefined, detail: string) => {
    if (!book) return
    text(label, pad, y, 28, MUTED, 600)
    text(book.title, pad, y + 46, 38, INK, 600)
    text(detail, pad, y + 88, 28, MUTED)
    y += 140
  }
  highlight(r.longest, review.longest, review.longest?.pages ? r.pages(formatNumber(review.longest.pages)) : '')
  highlight(r.fastest, review.fastest, review.fastest ? r.inDays(review.fastest.days) : '')
  highlight(r.highestRated, review.highestRated, review.highestRated?.rating !== undefined ? `${'★'.repeat(Math.floor(review.highestRated.rating))}${review.highestRated.rating % 1 ? '½' : ''}` : '')

  if (review.streak.length) text(`${r.streak}: ${r.streakDays(review.streak.length)}`, pad, Math.min(y + 10, H - pad), 32, INK, 600)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image.'))), 'image/png'))
}

/** Shares the image where the device supports it (phones), otherwise downloads it. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
