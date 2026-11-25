import { afterEach, describe, expect, it } from 'vitest'

import { applyTheme, DEFAULT_THEME, readStoredTheme, saveTheme, THEME_KEY } from './themes'

describe('themes', () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('defaults to Classic and ignores unknown stored values', () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME)
    localStorage.setItem(THEME_KEY, 'neon')
    expect(readStoredTheme()).toBe('classic')
  })

  it('saves the theme and sets it on <html>', () => {
    saveTheme('aurora')
    expect(localStorage.getItem(THEME_KEY)).toBe('aurora')
    expect(readStoredTheme()).toBe('aurora')
    expect(document.documentElement.dataset.theme).toBe('aurora')
  })

  it('uses the dark colour for the browser chrome on an always-dark theme', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
    applyTheme('midnight')
    expect(meta.content).toBe('#0a0d1c')
    meta.remove()
  })
})
