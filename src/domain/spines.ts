/**
 * Bookshelf view (design doc, Bookshelf): each book is drawn as a spine on a
 * shelf. These pure helpers decide a spine's size and colour and pack the
 * spines onto shelves, so the UI only draws.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Spine width in CSS pixels for a page count: thicker books get thicker spines. */
export const SPINE_MIN_WIDTH = 16
export const SPINE_MAX_WIDTH = 52
const UNKNOWN_PAGES_WIDTH = 26

export function spineWidth(pageCount: number | undefined): number {
  if (!pageCount || pageCount <= 0) return UNKNOWN_PAGES_WIDTH
  return Math.round(Math.min(SPINE_MAX_WIDTH, Math.max(SPINE_MIN_WIDTH, 12 + pageCount * 0.055)))
}

/** Small stable hash, so the same book always gets the same height and fallback colour. */
export function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Spine height as a share of the shelf height, between 0.78 and 0.98, so a shelf looks naturally uneven. */
export function spineHeightRatio(key: string): number {
  return 0.78 + (hashString(`h:${key}`) % 21) / 100
}

/** Book-cloth colours for books without a usable cover. */
export const CLOTH_COLOURS: readonly Rgb[] = [
  { r: 140, g: 47, b: 57 }, // oxblood
  { r: 35, g: 57, b: 91 }, // navy
  { r: 47, g: 93, b: 80 }, // forest
  { r: 201, g: 162, b: 39 }, // mustard
  { r: 94, g: 60, b: 88 }, // plum
  { r: 31, g: 111, b: 120 }, // teal
  { r: 181, g: 86, b: 43 }, // burnt orange
  { r: 74, g: 85, b: 104 }, // slate
  { r: 232, g: 220, b: 192 }, // cream
  { r: 107, g: 115, b: 57 }, // olive
  { r: 181, g: 101, b: 118 }, // rose
  { r: 45, g: 45, b: 52 }, // charcoal
]

export function fallbackSpineColour(key: string): Rgb {
  return CLOTH_COLOURS[hashString(key) % CLOTH_COLOURS.length]!
}

function toHsl({ r, g, b }: Rgb): { s: number; l: number } {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { s, l }
}

/**
 * The dominant colour of RGBA pixel data (a downscaled cover). Pixels are
 * grouped into coarse colour buckets; colourful pixels count more than grey,
 * near-white and near-black ones, because a cover's colour is what a spine
 * would carry, not its paper or its text. Returns undefined for no pixels.
 */
export function dominantColour(pixels: ArrayLike<number>): Rgb | undefined {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>()
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 128) continue
    const r = pixels[i]!
    const g = pixels[i + 1]!
    const b = pixels[i + 2]!
    const { s, l } = toHsl({ r, g, b })
    const extreme = l > 0.94 || l < 0.06 ? 0.15 : 1
    const weight = (0.25 + s) * extreme
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 }
    bucket.weight += weight
    bucket.r += r * weight
    bucket.g += g * weight
    bucket.b += b * weight
    buckets.set(key, bucket)
  }
  let best: { weight: number; r: number; g: number; b: number } | undefined
  for (const bucket of buckets.values()) if (!best || bucket.weight > best.weight) best = bucket
  if (!best || best.weight === 0) return undefined
  return { r: Math.round(best.r / best.weight), g: Math.round(best.g / best.weight), b: Math.round(best.b / best.weight) }
}

/** Relative luminance (WCAG). */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Dark or light lettering, whichever contrasts more with the spine. */
export function spineInk(colour: Rgb): 'dark' | 'light' {
  const l = luminance(colour)
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? 'dark' : 'light'
}

export const rgbCss = ({ r, g, b }: Rgb) => `rgb(${r} ${g} ${b})`

/**
 * Packs spines left to right onto shelves of the given inner width, in
 * order, starting a new shelf when the next spine doesn't fit. Returns the
 * item indexes per shelf; a spine wider than a shelf still gets one.
 */
export function packShelves(widths: readonly number[], shelfWidth: number, gap: number): number[][] {
  const shelves: number[][] = []
  let current: number[] = []
  let used = 0
  widths.forEach((w, i) => {
    const needed = current.length === 0 ? w : used + gap + w
    if (current.length > 0 && needed > shelfWidth) {
      shelves.push(current)
      current = [i]
      used = w
    } else {
      current.push(i)
      used = needed
    }
  })
  if (current.length > 0) shelves.push(current)
  return shelves
}
