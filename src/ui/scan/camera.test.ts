import { GUIDE, guideRegion } from './camera'

describe('guideRegion', () => {
  it('maps the guide box onto a video that fills the view exactly', () => {
    const r = guideRegion({ width: 1000, height: 750 }, { width: 400, height: 300 }, 0)
    expect(r).toEqual({ x: GUIDE.x * 1000, y: Math.round(GUIDE.y * 750), width: Math.round(GUIDE.width * 1000), height: Math.round(GUIDE.height * 750) })
  })

  it('accounts for the sides a 16:9 video loses in a 4:3 view', () => {
    // 1920×1080 scaled to 300 high is 533 wide, so 66.7 px are cut off each side.
    const r = guideRegion({ width: 1920, height: 1080 }, { width: 400, height: 300 }, 0)
    const scale = 300 / 1080
    expect(r.x).toBeCloseTo((GUIDE.x * 400 + (1920 * scale - 400) / 2) / scale, -1)
    expect(r.width).toBeCloseTo((GUIDE.width * 400) / scale, -1)
    expect(r.height).toBeCloseTo(GUIDE.height * 1080, -1)
  })

  it('adds a margin but stays inside the frame', () => {
    const r = guideRegion({ width: 640, height: 480 }, { width: 400, height: 300 }, 0.5)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.width).toBeLessThanOrEqual(640)
    expect(r.y + r.height).toBeLessThanOrEqual(480)
  })
})
