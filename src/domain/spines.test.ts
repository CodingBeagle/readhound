import { describe, expect, it } from 'vitest'

import { dominantColour, fallbackSpineColour, packShelves, spineHeightRatio, spineInk, spineWidth, SPINE_MAX_WIDTH, SPINE_MIN_WIDTH } from './spines'

const pixels = (...colours: [number, number, number, number?][]) => colours.flatMap(([r, g, b, a = 255]) => [r, g, b, a])

describe('spineWidth', () => {
  it('grows with the page count within limits', () => {
    expect(spineWidth(100)).toBeLessThan(spineWidth(400))
    expect(spineWidth(20)).toBe(SPINE_MIN_WIDTH)
    expect(spineWidth(5000)).toBe(SPINE_MAX_WIDTH)
  })
  it('uses a middling width when the page count is unknown', () => {
    expect(spineWidth(undefined)).toBe(26)
    expect(spineWidth(0)).toBe(26)
  })
})

describe('spineHeightRatio', () => {
  it('is stable per book and within range', () => {
    expect(spineHeightRatio('a')).toBe(spineHeightRatio('a'))
    for (const key of ['a', 'b', 'Dune', 'Lykke-Per']) {
      expect(spineHeightRatio(key)).toBeGreaterThanOrEqual(0.78)
      expect(spineHeightRatio(key)).toBeLessThanOrEqual(0.98)
    }
  })
})

describe('dominantColour', () => {
  it('picks the main cover colour over white paper and black text', () => {
    const data = pixels(...Array(10).fill([250, 250, 250]), ...Array(6).fill([10, 10, 10]), ...Array(5).fill([200, 30, 40]))
    const c = dominantColour(data)!
    expect(c.r).toBeGreaterThan(150)
    expect(c.g).toBeLessThan(60)
  })
  it('ignores transparent pixels and returns undefined for none', () => {
    expect(dominantColour(pixels([255, 0, 0, 0]))).toBeUndefined()
    expect(dominantColour([])).toBeUndefined()
  })
  it('still finds a colour on an all-grey cover', () => {
    expect(dominantColour(pixels([120, 120, 120], [121, 121, 121]))).toEqual({ r: 121, g: 121, b: 121 })
  })
})

describe('spineInk', () => {
  it('chooses lettering that contrasts with the spine', () => {
    expect(spineInk({ r: 240, g: 230, b: 200 })).toBe('dark')
    expect(spineInk({ r: 35, g: 57, b: 91 })).toBe('light')
  })
})

describe('fallbackSpineColour', () => {
  it('is stable per book', () => {
    expect(fallbackSpineColour('Dune')).toEqual(fallbackSpineColour('Dune'))
  })
})

describe('packShelves', () => {
  it('fills each shelf in order before starting the next', () => {
    expect(packShelves([30, 30, 30, 30], 100, 2)).toEqual([[0, 1, 2], [3]])
  })
  it('gives an over-wide spine its own shelf', () => {
    expect(packShelves([150, 20], 100, 2)).toEqual([[0], [1]])
  })
  it('returns no shelves for no books', () => {
    expect(packShelves([], 100, 2)).toEqual([])
  })
})
