/**
 * The Readhound logo: a beagle peeking over an open book (design doc, Brand).
 *
 * This file is the single source of the artwork. The in-app logo
 * (`HoundLogo.tsx`) draws these shapes as React elements so parts can animate,
 * and `scripts/generate-icons.ts` turns them into the SVG and PNG icons in
 * `public/`. It must stay plain data with relative imports only, because that
 * script runs it in Node.
 */

/** Artwork is drawn on a 512 × 512 canvas. */
export const HOUND_VIEWBOX = 512

/** Fixed brand colours: the logo looks the same in every theme. */
export const houndColors = {
  gradient: ['#7c3aed', '#db2777', '#f97316'],
  fur: '#d08a4a',
  ear: '#6b3518',
  cream: '#fff7ed',
  ink: '#1c1917',
  page: '#ffffff',
  pageShade: '#fde7d4',
  spine: '#7c2d12',
} as const

export const houndShapes = {
  head: 'M256 118c66 0 100 52 100 116c0 72-44 112-100 112s-100-40-100-112c0-64 34-116 100-116z',
  blaze: 'M242 132c8-4 20-4 28 0l12 128h-52z',
  muzzle: { cx: 256, cy: 292, rx: 66, ry: 50 },
  earLeft: 'M184 140c-52-6-86 44-84 120c2 56 22 94 52 90c28-4 36-44 36-100c0-46-2-86-4-110z',
  earRight: 'M328 140c52-6 86 44 84 120c-2 56-22 94-52 90c-28-4-36-44-36-100c0-46 2-86 4-110z',
  eyes: [
    { cx: 218, cy: 222 },
    { cx: 294, cy: 222 },
  ],
  eyeRadius: 14,
  glintOffset: { dx: 5, dy: -5, r: 4.5 },
  nose: 'M232 262c0-10 48-10 48 0c0 14-14 24-24 24s-24-10-24-24z',
  pageLeft: 'M84 340c64-24 128-22 172 6v100c-44-28-108-30-172-6z',
  pageRight: 'M428 340c-64-24-128-22-172 6v100c44-28 108-30 172-6z',
  spine: 'M256 346v100',
  paws: [
    { cx: 190, cy: 336 },
    { cx: 322, cy: 336 },
  ],
  pawSize: { rx: 30, ry: 20 },
  toes: 'M180 328v12M196 328v12M312 328v12M328 328v12',
} as const

export type HoundBackground = 'rounded' | 'square' | 'none'

/**
 * The logo as a standalone SVG document.
 * - `rounded`: the app badge (favicon, PWA icons with transparent corners).
 * - `square`: full bleed, for icons the platform masks itself (maskable, Apple touch).
 * - `none`: just the hound and book.
 * `scale` shrinks the artwork around the centre, e.g. 0.8 keeps it in the maskable safe zone.
 */
export function houndSvg({ background = 'rounded', scale = 1 }: { background?: HoundBackground; scale?: number } = {}): string {
  const s = houndShapes
  const c = houndColors
  const size = HOUND_VIEWBOX
  const [from, via, to] = c.gradient
  const offset = Math.round(size * (1 - scale) * 50) / 100
  const bg =
    background === 'none'
      ? ''
      : `<defs><linearGradient id="rh-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="0.55" stop-color="${via}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
        `<rect width="${size}" height="${size}"${background === 'rounded' ? ' rx="112"' : ''} fill="url(#rh-bg)"/>`
  const eyes = s.eyes
    .map(
      (e) =>
        `<circle cx="${e.cx}" cy="${e.cy}" r="${s.eyeRadius}" fill="${c.ink}"/>` +
        `<circle cx="${e.cx + s.glintOffset.dx}" cy="${e.cy + s.glintOffset.dy}" r="${s.glintOffset.r}" fill="#fff"/>`,
    )
    .join('')
  const paws = s.paws.map((p) => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${s.pawSize.rx}" ry="${s.pawSize.ry}" fill="${c.cream}"/>`).join('')
  const art =
    `<path d="${s.head}" fill="${c.fur}"/>` +
    `<path d="${s.blaze}" fill="${c.cream}"/>` +
    `<ellipse cx="${s.muzzle.cx}" cy="${s.muzzle.cy}" rx="${s.muzzle.rx}" ry="${s.muzzle.ry}" fill="${c.cream}"/>` +
    `<path d="${s.earLeft}" fill="${c.ear}"/><path d="${s.earRight}" fill="${c.ear}"/>` +
    eyes +
    `<path d="${s.nose}" fill="${c.ink}"/>` +
    `<path d="${s.pageLeft}" fill="${c.page}"/><path d="${s.pageRight}" fill="${c.pageShade}"/>` +
    `<path d="${s.spine}" stroke="${c.spine}" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/>` +
    paws +
    `<path d="${s.toes}" stroke="${c.fur}" stroke-width="4" stroke-linecap="round"/>`
  const body = scale === 1 ? art : `<g transform="translate(${offset} ${offset}) scale(${scale})">${art}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${bg}${body}</svg>\n`
}
