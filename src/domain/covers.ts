/**
 * Cover photos (design doc, Cover photos): a photo the reader takes or picks
 * when a book has no cover, or a bad one. The photo is cropped to the 2:3
 * cover shape, scaled down, stored on the device as a JPEG data URL and
 * shown through the edition's `coverUrl` override, which holds a local
 * reference instead of a web address.
 */

/** Width ÷ height of a book cover. */
export const COVER_ASPECT = 2 / 3
/** Stored covers are at most this many pixels wide (and 1.5 times that tall). */
export const COVER_MAX_WIDTH = 600
/** Zoom range of the crop step, relative to the largest crop that fits. */
export const MAX_ZOOM = 4

const REF_PREFIX = 'readhound-cover:'

/** The `coverUrl` value that points at a stored cover photo. */
export function localCoverRef(coverId: string): string {
  return `${REF_PREFIX}${coverId}`
}

export function isLocalCoverRef(url: string | undefined): url is string {
  return typeof url === 'string' && url.startsWith(REF_PREFIX)
}

export function coverIdFromRef(url: string): string | undefined {
  return isLocalCoverRef(url) ? url.slice(REF_PREFIX.length) || undefined : undefined
}

/** Only image data URLs are stored as covers. */
export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(value)
}

export interface Size {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** What the reader chose in the crop step: zoom ≥ 1 and the crop centre in image pixels. */
export interface CropState {
  zoom: number
  centerX: number
  centerY: number
}

export function initialCrop(image: Size): CropState {
  return { zoom: 1, centerX: image.width / 2, centerY: image.height / 2 }
}

/** The largest 2:3 rectangle that fits in the image, at zoom 1. */
export function baseCropSize(image: Size): Size {
  if (image.width / image.height > COVER_ASPECT) return { width: image.height * COVER_ASPECT, height: image.height }
  return { width: image.width, height: image.width / COVER_ASPECT }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** The part of the image that becomes the cover. It always keeps the 2:3 shape and stays inside the image. */
export function cropRect(image: Size, crop: CropState): Rect {
  const zoom = clamp(crop.zoom, 1, MAX_ZOOM)
  const base = baseCropSize(image)
  const width = base.width / zoom
  const height = base.height / zoom
  const x = clamp(crop.centerX - width / 2, 0, image.width - width)
  const y = clamp(crop.centerY - height / 2, 0, image.height - height)
  return { x, y, width, height }
}

/** Keeps the state in range, so the centre doesn't drift beyond where the crop can go. */
export function normalizeCrop(image: Size, crop: CropState): CropState {
  const zoom = clamp(crop.zoom, 1, MAX_ZOOM)
  const rect = cropRect(image, { ...crop, zoom })
  return { zoom, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 }
}

/**
 * Dragging the preview by (dx, dy) screen pixels moves the picture under the
 * frame, so the crop moves the other way, scaled from preview to image pixels.
 */
export function panCrop(image: Size, crop: CropState, dx: number, dy: number, previewWidth: number): CropState {
  const rect = cropRect(image, crop)
  const scale = rect.width / previewWidth
  return normalizeCrop(image, { ...crop, centerX: rect.x + rect.width / 2 - dx * scale, centerY: rect.y + rect.height / 2 - dy * scale })
}

/** Output size: the crop's own size, scaled down to at most COVER_MAX_WIDTH wide, never up. */
export function coverOutputSize(rect: Rect): Size {
  const width = Math.max(1, Math.round(Math.min(COVER_MAX_WIDTH, rect.width)))
  return { width, height: Math.round(width / COVER_ASPECT) }
}

/** Image size after turning it by a number of quarter turns. */
export function rotatedSize(image: Size, quarterTurns: number): Size {
  return quarterTurns % 2 === 0 ? image : { width: image.height, height: image.width }
}
