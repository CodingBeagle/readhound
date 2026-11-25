import { baseCropSize, coverIdFromRef, coverOutputSize, cropRect, initialCrop, isImageDataUrl, isLocalCoverRef, localCoverRef, panCrop, rotatedSize } from './covers'

describe('cover references', () => {
  it('round-trips a cover id and tells local covers from web addresses', () => {
    const ref = localCoverRef('abc')
    expect(isLocalCoverRef(ref)).toBe(true)
    expect(coverIdFromRef(ref)).toBe('abc')
    expect(isLocalCoverRef('https://covers.openlibrary.org/b/id/1-M.jpg')).toBe(false)
    expect(isLocalCoverRef(undefined)).toBe(false)
    expect(coverIdFromRef('readhound-cover:')).toBeUndefined()
  })

  it('accepts only image data URLs', () => {
    expect(isImageDataUrl('data:image/jpeg;base64,AAAA')).toBe(true)
    expect(isImageDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isImageDataUrl('https://example.com/a.jpg')).toBe(false)
    expect(isImageDataUrl(42)).toBe(false)
  })
})

describe('cropping to the cover shape', () => {
  const landscape = { width: 4000, height: 3000 }
  const portrait = { width: 3000, height: 6000 }

  it('takes the largest 2:3 part that fits, centred', () => {
    expect(baseCropSize(landscape)).toEqual({ width: 2000, height: 3000 })
    expect(baseCropSize(portrait)).toEqual({ width: 3000, height: 4500 })
    expect(cropRect(landscape, initialCrop(landscape))).toEqual({ x: 1000, y: 0, width: 2000, height: 3000 })
    expect(cropRect(portrait, initialCrop(portrait))).toEqual({ x: 0, y: 750, width: 3000, height: 4500 })
  })

  it('zooms in around the centre and never past the image edges', () => {
    expect(cropRect(landscape, { zoom: 2, centerX: 2000, centerY: 1500 })).toEqual({ x: 1500, y: 750, width: 1000, height: 1500 })
    expect(cropRect(landscape, { zoom: 2, centerX: 0, centerY: 99999 })).toEqual({ x: 0, y: 1500, width: 1000, height: 1500 })
    // Zoom is kept between 1 and 4.
    expect(cropRect(landscape, { zoom: 0.2, centerX: 2000, centerY: 1500 }).width).toBe(2000)
    expect(cropRect(landscape, { zoom: 10, centerX: 2000, centerY: 1500 }).width).toBe(500)
  })

  it('moves the crop against the drag, scaled from preview to image pixels', () => {
    // Preview 200 px wide shows 2000 image px: dragging 10 px right moves the crop 100 px left.
    const moved = panCrop(landscape, initialCrop(landscape), 10, 0, 200)
    expect(cropRect(landscape, moved).x).toBe(900)
    // Dragging far beyond the edge stops at the edge.
    expect(cropRect(landscape, panCrop(landscape, initialCrop(landscape), 5000, 5000, 200))).toMatchObject({ x: 0, y: 0 })
  })

  it('scales the output down to 600 × 900 but never up', () => {
    expect(coverOutputSize({ x: 0, y: 0, width: 2000, height: 3000 })).toEqual({ width: 600, height: 900 })
    expect(coverOutputSize({ x: 0, y: 0, width: 300, height: 450 })).toEqual({ width: 300, height: 450 })
  })

  it('swaps width and height for a quarter turn', () => {
    expect(rotatedSize(landscape, 1)).toEqual({ width: 3000, height: 4000 })
    expect(rotatedSize(landscape, 2)).toEqual(landscape)
  })
})
