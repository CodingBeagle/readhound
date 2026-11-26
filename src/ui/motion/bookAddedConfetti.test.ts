import confetti from 'canvas-confetti'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { celebrateBookAdded, themeConfettiColors } from './bookAddedConfetti'

const fire = vi.mocked(confetti)

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  fire.mockClear()
  document.documentElement.removeAttribute('style')
})

describe('themeConfettiColors', () => {
  it("uses the active theme's hex chart colours", () => {
    document.documentElement.style.setProperty('--chart-1', '#6d28d9')
    document.documentElement.style.setProperty('--chart-2', ' #db2777 ')
    document.documentElement.style.setProperty('--chart-3', 'oklch(0.7 0.1 200)')
    expect(themeConfettiColors()).toEqual(['#6d28d9', '#db2777'])
  })

  it('falls back to the reference palette when no token is a hex colour', () => {
    expect(themeConfettiColors()).toHaveLength(6)
  })
})

describe('celebrateBookAdded', () => {
  it('fires two corner cannons and a centre pop in theme colours', async () => {
    vi.useFakeTimers()
    setReducedMotion(false)
    document.documentElement.style.setProperty('--chart-1', '#a3e635')
    await celebrateBookAdded()
    vi.runAllTimers()
    expect(fire).toHaveBeenCalledTimes(3)
    expect(fire.mock.calls[0]![0]).toMatchObject({ colors: ['#a3e635'], disableForReducedMotion: true, origin: { x: 0 } })
    expect(fire.mock.calls[1]![0]).toMatchObject({ origin: { x: 1 } })
  })

  it('does nothing when the reader prefers reduced motion', async () => {
    setReducedMotion(true)
    await celebrateBookAdded()
    expect(fire).not.toHaveBeenCalled()
  })
})
