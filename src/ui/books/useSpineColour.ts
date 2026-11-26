import { useEffect, useState } from 'react'

import { useServices } from '@/app/services'
import { coverIdFromRef, isLocalCoverRef } from '@/domain/covers'
import { dominantColour, fallbackSpineColour, type Rgb } from '@/domain/spines'

/** Colours already read from covers, by cover URL, for this visit. */
const cache = new Map<string, Rgb | null>()
const SAMPLE_W = 24
const SAMPLE_H = 36

function sampleImage(src: string): Promise<Rgb | null> {
  return new Promise((resolve) => {
    const img = new Image()
    // Open Library serves covers with CORS headers, so the canvas stays readable.
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE_W
        canvas.height = SAMPLE_H
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H)
        resolve(dominantColour(ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data) ?? null)
      } catch {
        // A tainted canvas (no CORS) or a broken image: use the cloth colour.
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * The spine colour for a book: the cover's dominant colour once it has been
 * read, and a stable cloth colour until then or when there is no cover.
 */
export function useSpineColour(coverUrl: string | undefined, key: string): Rgb {
  const { db } = useServices()
  const fallback = fallbackSpineColour(key)
  // The colour read for the current cover; a cover read earlier in this visit comes from the cache.
  const [read, setRead] = useState<{ url: string; colour: Rgb | null }>()

  useEffect(() => {
    if (!coverUrl || cache.has(coverUrl)) return
    let live = true
    void (async () => {
      let src: string | undefined = coverUrl
      if (isLocalCoverRef(coverUrl)) {
        const id = coverIdFromRef(coverUrl)
        src = id ? (await db.covers.get(id))?.dataUrl : undefined
      }
      const colour = src ? await sampleImage(src) : null
      cache.set(coverUrl, colour)
      if (live) setRead({ url: coverUrl, colour })
    })()
    return () => {
      live = false
    }
  }, [coverUrl, db])

  if (!coverUrl) return fallback
  const colour = cache.get(coverUrl) ?? (read?.url === coverUrl ? read.colour : null)
  return colour ?? fallback
}
