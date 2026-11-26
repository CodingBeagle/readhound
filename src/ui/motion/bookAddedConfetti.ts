/**
 * The confetti splash when a new book lands in the library (design doc, Animation).
 * canvas-confetti is loaded on first use, so it costs nothing until a book is
 * added, and the splash never blocks: callers fire it and navigate straight on.
 * Colours are the active theme's chart palette, read at fire time so a theme
 * switch is picked up. Nothing happens when the reader prefers reduced motion.
 */

/** The theme tokens the pieces are painted with, the same set the finish burst uses. */
const COLOR_TOKENS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-7']
const FALLBACK_COLORS = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#6a4ce2']

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** The active theme's confetti colours, as hex (canvas-confetti only takes hex). */
export function themeConfettiColors(root: Element = document.documentElement): string[] {
  const style = getComputedStyle(root)
  const colors = COLOR_TOKENS.map((token) => style.getPropertyValue(token).trim()).filter((c) => HEX.test(c))
  return colors.length > 0 ? colors : FALLBACK_COLORS
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fires the splash: two cannons from the bottom corners and a pop from the middle. Resolves once it has started. */
export async function celebrateBookAdded(): Promise<void> {
  if (typeof window === 'undefined' || prefersReducedMotion()) return
  try {
    const { default: confetti } = await import('canvas-confetti')
    const colors = themeConfettiColors()
    const base = { colors, disableForReducedMotion: true, zIndex: 60, ticks: 220, scalar: 0.95 }
    confetti({ ...base, particleCount: 70, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.95 } })
    confetti({ ...base, particleCount: 70, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.95 } })
    setTimeout(() => confetti({ ...base, particleCount: 90, spread: 100, startVelocity: 38, gravity: 0.9, origin: { x: 0.5, y: 0.4 }, shapes: ['square', 'circle'] }), 180)
  } catch {
    // A missing chunk (offline before it was cached) or no canvas: the book is added either way.
  }
}
