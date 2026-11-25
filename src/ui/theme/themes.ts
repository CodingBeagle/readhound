/**
 * App themes (design doc, Themes). A theme is a set of CSS tokens and a few
 * component treatments in `index.css`, switched by `data-theme` on <html>.
 * The choice is a per-device preference kept in localStorage, so it applies
 * before the first paint (see the inline script in index.html).
 */
export const THEMES = ['classic', 'aurora', 'bookshop', 'midnight'] as const
export type ThemeId = (typeof THEMES)[number]

export const DEFAULT_THEME: ThemeId = 'classic'
export const THEME_KEY = 'readhound.theme'

/** Colours for the picker's preview and the browser's theme-color, light then dark. */
export const THEME_PREVIEW: Record<ThemeId, { light: Swatch; dark: Swatch; darkOnly?: boolean }> = {
  classic: {
    light: { bg: '#fafaf9', card: '#ffffff', ink: '#1c1917', accent: '#f59e0b', accent2: '#257de0' },
    dark: { bg: '#0c0a09', card: '#1c1917', ink: '#fafaf9', accent: '#f59e0b', accent2: '#338ced' },
  },
  aurora: {
    light: { bg: '#f5f3ff', card: '#ffffff', ink: '#1e1b3a', accent: '#7c3aed', accent2: '#db2777' },
    dark: { bg: '#110d24', card: '#1d1838', ink: '#f1efff', accent: '#a78bfa', accent2: '#f472b6' },
  },
  bookshop: {
    light: { bg: '#f5efe3', card: '#fffaf0', ink: '#1f1a17', accent: '#c2410c', accent2: '#2f6b4f' },
    dark: { bg: '#1b1612', card: '#28211b', ink: '#f5ead8', accent: '#f08c5a', accent2: '#7fbf9a' },
  },
  midnight: {
    light: { bg: '#0a0d1c', card: '#131834', ink: '#eef0ff', accent: '#a3e635', accent2: '#22d3ee' },
    dark: { bg: '#0a0d1c', card: '#131834', ink: '#eef0ff', accent: '#a3e635', accent2: '#22d3ee' },
    darkOnly: true,
  },
}

export interface Swatch {
  bg: string
  card: string
  ink: string
  accent: string
  accent2: string
}

export const isThemeId = (value: unknown): value is ThemeId => typeof value === 'string' && (THEMES as readonly string[]).includes(value)

export function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isThemeId(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

/** Sets the theme on <html> and the browser chrome colour. */
export function applyTheme(theme: ThemeId): void {
  const root = document.documentElement
  root.dataset.theme = theme
  const preview = THEME_PREVIEW[theme]
  const swatch = preview.darkOnly || prefersDark() ? preview.dark : preview.light
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', swatch.bg)
}

/** Saves and applies a theme, cross-fading where the browser supports view transitions. */
export function saveTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce && typeof document.startViewTransition === 'function') document.startViewTransition(() => applyTheme(theme))
  else applyTheme(theme)
  listeners.forEach((l) => l())
}

const listeners = new Set<() => void>()
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
