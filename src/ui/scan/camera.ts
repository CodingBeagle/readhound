/**
 * Camera set-up for barcode scanning. A book barcode is small and has thin
 * bars, so a sharp picture matters more than anything else: ask for a high
 * resolution, keep autofocus running, and zoom in a little so the phone can
 * be held far enough away to focus (most phone cameras can't focus closer
 * than about 10 cm).
 */

/** Camera features that browsers support unevenly and the DOM typings leave out. */
interface ExtraCapabilities {
  focusMode?: string[]
  exposureMode?: string[]
  zoom?: { min: number; max: number; step: number }
  torch?: boolean
  pointsOfInterest?: unknown
}

export interface ZoomRange {
  min: number
  max: number
  step: number
}

export interface CameraFeatures {
  zoom?: ZoomRange & { value: number }
  torch: boolean
  /** Tap-to-focus: the camera can focus once on a point. */
  focus: boolean
}

/** Zoom the camera starts at, when it can zoom: the book can sit 15–25 cm away and still fill the frame. */
const START_ZOOM = 2

/** Opens the back camera at the best resolution it offers up to 1080p. */
export async function openCamera(): Promise<MediaStream> {
  const video = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
  return navigator.mediaDevices.getUserMedia({ audio: false, video })
}

const capabilities = (track: MediaStreamTrack) => (track.getCapabilities?.() ?? {}) as ExtraCapabilities

const apply = (track: MediaStreamTrack, set: Record<string, unknown>) =>
  track.applyConstraints({ advanced: [set as MediaTrackConstraintSet] }).then(
    () => true,
    () => false,
  )

/** Turns on continuous autofocus and exposure and a starting zoom, where the camera has them. */
export async function tuneCamera(track: MediaStreamTrack): Promise<CameraFeatures> {
  const caps = capabilities(track)
  if (caps.focusMode?.includes('continuous')) await apply(track, { focusMode: 'continuous' })
  if (caps.exposureMode?.includes('continuous')) await apply(track, { exposureMode: 'continuous' })
  let zoom: CameraFeatures['zoom']
  if (caps.zoom && caps.zoom.max > caps.zoom.min) {
    const value = Math.min(caps.zoom.max, Math.max(caps.zoom.min, START_ZOOM))
    zoom = { ...caps.zoom, value: (await apply(track, { zoom: value })) ? value : caps.zoom.min }
  }
  return {
    zoom,
    torch: !!caps.torch,
    focus: !!caps.focusMode?.includes('single-shot') || !!caps.focusMode?.includes('manual'),
  }
}

export const setZoom = (track: MediaStreamTrack, zoom: number) => apply(track, { zoom })
export const setTorch = (track: MediaStreamTrack, on: boolean) => apply(track, { torch: on })

/**
 * Focuses once, on the tapped point where the camera supports points of
 * interest (x and y from 0 to 1), then goes back to continuous autofocus.
 */
export async function focusAt(track: MediaStreamTrack, x: number, y: number) {
  const caps = capabilities(track)
  if (!caps.focusMode?.includes('single-shot')) return
  const point = caps.pointsOfInterest ? { pointsOfInterest: [{ x, y }] } : {}
  await apply(track, { focusMode: 'single-shot', ...point })
  if (caps.focusMode.includes('continuous')) setTimeout(() => void apply(track, { focusMode: 'continuous' }), 1500)
}

/** The guide box's place in the camera view, as fractions of the view: wide and short, like a book barcode. */
export const GUIDE = { x: 0.08, y: 0.28, width: 0.84, height: 0.44 }

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The part of the video frame, in the video's own pixels, that shows under
 * the guide box, with a margin since nobody lines a book up exactly. The
 * video fills its box like CSS `object-fit: cover`, so the edges of the
 * frame may be cut off on screen.
 */
export function guideRegion(video: { width: number; height: number }, view: { width: number; height: number }, margin = 0.1): Rect {
  const scale = Math.max(view.width / video.width, view.height / video.height)
  const offsetX = (view.width - video.width * scale) / 2
  const offsetY = (view.height - video.height * scale) / 2
  const mx = GUIDE.width * margin
  const my = GUIDE.height * margin
  const left = ((GUIDE.x - mx) * view.width - offsetX) / scale
  const top = ((GUIDE.y - my) * view.height - offsetY) / scale
  const right = ((GUIDE.x + GUIDE.width + mx) * view.width - offsetX) / scale
  const bottom = ((GUIDE.y + GUIDE.height + my) * view.height - offsetY) / scale
  const x = Math.max(0, Math.round(left))
  const y = Math.max(0, Math.round(top))
  return {
    x,
    y,
    width: Math.min(video.width, Math.round(right)) - x,
    height: Math.min(video.height, Math.round(bottom)) - y,
  }
}
