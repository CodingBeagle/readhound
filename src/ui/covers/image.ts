/**
 * Browser-side image work for cover photos: decoding a picked file, turning
 * it, and drawing the chosen crop to a small JPEG (design doc, Cover photos).
 * The crop maths are pure functions in `domain/covers`.
 */
import { coverOutputSize, cropRect, rotatedSize, type CropState, type Size } from '@/domain/covers'
import type { CoverPhotoInput } from '@/db'

/** JPEG quality, and a lower one for photos that still come out large. */
const QUALITY = 0.85
const FALLBACK_QUALITY = 0.7
/** Data URLs longer than this (about 300 KB of JPEG) are encoded again at the lower quality. */
const MAX_DATA_URL_LENGTH = 400_000

export type ImageSource = HTMLImageElement | HTMLCanvasElement

export function sourceSize(source: ImageSource): Size {
  return source instanceof HTMLImageElement ? { width: source.naturalWidth, height: source.naturalHeight } : { width: source.width, height: source.height }
}

/** Decodes an image file. Browsers apply the photo's EXIF orientation when drawing it. */
export async function loadImageFile(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    // The decoded image stays drawable after the URL is released.
    URL.revokeObjectURL(url)
  }
}

/** The image turned clockwise by a number of quarter turns. */
export function rotateImage(image: ImageSource, quarterTurns: number): ImageSource {
  const turns = ((quarterTurns % 4) + 4) % 4
  if (turns === 0) return image
  const size = sourceSize(image)
  const out = rotatedSize(size, turns)
  const canvas = document.createElement('canvas')
  canvas.width = out.width
  canvas.height = out.height
  const ctx = canvas.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(image, -size.width / 2, -size.height / 2)
  return canvas
}

/** Draws the crop into a canvas of the given size. */
export function drawCrop(canvas: HTMLCanvasElement, source: ImageSource, crop: CropState, width: number, height: number) {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = cropRect(sourceSize(source), crop)
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height)
}

/** The finished cover: the crop at most 600 × 900, as a JPEG data URL. */
export function renderCover(source: ImageSource, crop: CropState): CoverPhotoInput {
  const size = coverOutputSize(cropRect(sourceSize(source), crop))
  const canvas = document.createElement('canvas')
  drawCrop(canvas, source, crop, size.width, size.height)
  let dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  if (dataUrl.length > MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL('image/jpeg', FALLBACK_QUALITY)
  return { dataUrl, ...size }
}
