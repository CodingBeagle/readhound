import { Camera, Flashlight, X, ZoomIn } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { t } from '@/i18n'
import { isbnFromBarcode, parseIsbn } from '@/sources/isbn'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'

import { GUIDE, focusAt, guideRegion, openCamera, setTorch as applyTorch, setZoom as applyZoom, tuneCamera, type CameraFeatures } from './camera'
import { createBarcodeReader, readPhoto, type BarcodeReader } from './detector'

const s = t.scan
/** Time between two reads of the video. Fast enough to feel instant, slow enough to spare the battery. */
const SCAN_INTERVAL_MS = 150
/** After this long without a read, tips on holding the book appear. */
const TIP_AFTER_MS = 5000

type CameraState = 'starting' | 'scanning' | 'denied' | 'noCamera' | 'unsupported' | 'failed'

const CAMERA_MESSAGES: Partial<Record<CameraState, string>> = {
  denied: s.denied,
  noCamera: s.noCamera,
  unsupported: s.unsupported,
  failed: s.failed,
}

/**
 * Scan an ISBN barcode with the back camera, or type the ISBN (design doc,
 * Barcode scanning). Calls `onIsbn` with the first valid ISBN it reads.
 * When the live camera can't be used, a photo of the barcode works too.
 */
export function ScanDialog({ onIsbn, onClose }: { onIsbn: (isbn: string) => void; onClose: () => void }) {
  const [camera, setCamera] = useState<CameraState>('starting')
  const [wrongCode, setWrongCode] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState(false)
  const [track, setTrack] = useState<MediaStreamTrack | null>(null)
  const [features, setFeatures] = useState<CameraFeatures | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [zoom, setZoomValue] = useState<number>()
  const [showTips, setShowTips] = useState(false)
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const reader = useRef<Promise<BarcodeReader> | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const onIsbnRef = useRef(onIsbn)
  useLayoutEffect(() => {
    onIsbnRef.current = onIsbn
  })
  const inputId = useId()

  const getReader = () => (reader.current ??= createBarcodeReader())

  /** Hands over the first ISBN among the codes read; true when one was found. */
  const accept = (codes: { rawValue: string }[]) => {
    const isbn = codes.map((c) => isbnFromBarcode(c.rawValue)).find((x): x is string => !!x)
    if (!isbn) return false
    if (!done.current) {
      done.current = true
      navigator.vibrate?.(40)
      onIsbnRef.current(isbn)
    }
    return true
  }

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let tipTimer: ReturnType<typeof setTimeout> | undefined
    const stop = () => stream?.getTracks().forEach((track) => track.stop())

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return setCamera('noCamera')
      // Ask for the camera while the reader loads; both take a moment.
      const [loaded, opened] = await Promise.allSettled([getReader(), openCamera()])
      if (opened.status === 'fulfilled') stream = opened.value
      if (stopped) return stop()
      if (loaded.status === 'rejected') {
        stop()
        return setCamera('unsupported')
      }
      if (opened.status === 'rejected') {
        const name = opened.reason instanceof DOMException ? opened.reason.name : ''
        if (name === 'NotAllowedError' || name === 'SecurityError') return setCamera('denied')
        if (name === 'NotFoundError' || name === 'OverconstrainedError') return setCamera('noCamera')
        return setCamera('failed')
      }
      const barcodes = loaded.value
      const el = video.current
      if (!el || !stream) return stop()
      el.srcObject = stream
      await el.play().catch(() => {})
      if (stopped) return
      setCamera('scanning')
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        setTrack(videoTrack)
        const tuned = await tuneCamera(videoTrack)
        if (stopped) return
        setFeatures(tuned)
        setZoomValue(tuned.zoom?.value)
      }
      tipTimer = setTimeout(() => setShowTips(true), TIP_AFTER_MS)

      // Reads alternate between the guide box at full resolution (sharper, and
      // faster to decode) and the whole frame (for a barcode held off-centre).
      const crop = document.createElement('canvas')
      let frame = 0
      const tick = async () => {
        if (stopped || done.current) return
        if (el.readyState >= el.HAVE_CURRENT_DATA && el.videoWidth > 0) {
          try {
            const codes = await barcodes.detect(frame++ % 2 === 0 ? guideCrop(el, crop) : el)
            if (accept(codes)) return stop()
            if (codes.length > 0) setWrongCode(true)
          } catch {
            // A frame that can't be read; try the next one.
          }
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS)
      }
      void tick()
    }
    void start()
    return () => {
      stopped = true
      clearTimeout(timer)
      clearTimeout(tipTimer)
      stop()
    }
  }, [])

  // Escape closes, like the other dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function photoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError(false)
    try {
      const codes = await readPhoto(await getReader(), file)
      if (!accept(codes)) setPhotoError(true)
    } catch {
      setPhotoError(true)
    }
  }

  function submitTyped(e: React.FormEvent) {
    e.preventDefault()
    const isbn = parseIsbn(typed)
    if (!isbn) return setTypedError(true)
    done.current = true
    onIsbn(isbn)
  }

  async function toggleTorch() {
    if (!track) return
    const on = !torchOn
    if (await applyTorch(track, on)) setTorchOn(on)
  }

  function changeZoom(value: number) {
    setZoomValue(value)
    if (track) void applyZoom(track, value)
  }

  /** Tap the picture to focus there, where the camera can. */
  function tapToFocus(e: React.PointerEvent<HTMLDivElement>) {
    if (!track || !features?.focus) return
    const box = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - box.left) / box.width
    const y = (e.clientY - box.top) / box.height
    setFocusPoint({ x, y })
    setTimeout(() => setFocusPoint(null), 800)
    void focusAt(track, x, y)
  }

  const cameraMessage = CAMERA_MESSAGES[camera]
  // A still photo from the phone's own camera app is autofocused and sharp, so it is always offered.
  const offerPhoto = camera !== 'unsupported'

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="scan-title" className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="surface flex max-h-full w-full max-w-sm flex-col gap-3 overflow-y-auto bg-background p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h2 id="scan-title" className="title text-lg">
            {s.title}
          </h2>
          <Button type="button" variant="ghost" size="icon" aria-label={s.close} onClick={onClose}>
            <X />
          </Button>
        </div>

        {!cameraMessage && (
          <>
            <div className="relative aspect-[4/3] touch-manipulation overflow-hidden rounded-lg bg-black" onPointerUp={tapToFocus}>
              <video ref={video} aria-label={s.video} muted playsInline autoPlay className="size-full object-cover" />
              {/* The box to aim at: wide and short, the shape of a book barcode. Reads look here first. */}
              <div
                aria-hidden
                className="pointer-events-none absolute rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ left: `${GUIDE.x * 100}%`, top: `${GUIDE.y * 100}%`, width: `${GUIDE.width * 100}%`, height: `${GUIDE.height * 100}%` }}
              >
                <div className="absolute inset-x-2 top-1/2 h-0.5 bg-primary motion-safe:animate-pulse" />
              </div>
              {focusPoint && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300"
                  style={{ left: `${focusPoint.x * 100}%`, top: `${focusPoint.y * 100}%` }}
                />
              )}
              {camera === 'starting' && (
                <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white">
                  {s.starting}
                </p>
              )}
              {features?.torch && (
                <Button
                  type="button"
                  size="sm"
                  variant={torchOn ? 'default' : 'secondary'}
                  aria-pressed={torchOn}
                  className="absolute right-2 bottom-2"
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={toggleTorch}
                >
                  <Flashlight />
                  {s.torch}
                </Button>
              )}
            </div>
            {features?.zoom && zoom !== undefined && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <ZoomIn aria-hidden className="size-4" />
                <span className="sr-only">{s.zoom}</span>
                <input
                  type="range"
                  className="flex-1 accent-primary"
                  min={features.zoom.min}
                  max={features.zoom.max}
                  step={features.zoom.step || 0.1}
                  value={zoom}
                  onChange={(e) => changeZoom(Number(e.target.value))}
                />
                <span className="w-10 text-right tabular-nums">{zoom.toFixed(1)}×</span>
              </label>
            )}
            <p className="text-sm text-muted-foreground">{features?.focus ? `${s.hint} ${s.tapToFocus}` : s.hint}</p>
            {wrongCode && (
              <p role="status" className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {s.notIsbn}
              </p>
            )}
            {showTips && !wrongCode && (
              <div role="status" className="surface flex flex-col gap-1 p-3 text-sm">
                <p className="font-medium">{s.tipsTitle}</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {s.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {cameraMessage && (
          <p role="alert" className="text-sm">
            {cameraMessage}
          </p>
        )}
        {offerPhoto && (
          <>
            <input ref={photoInput} type="file" accept="image/*" capture="environment" aria-label={s.photoLabel} className="hidden" onChange={photoPicked} />
            <Button type="button" variant="outline" onClick={() => photoInput.current?.click()}>
              <Camera />
              {cameraMessage ? s.photo : s.photoInstead}
            </Button>
            {photoError && (
              <p role="alert" className="text-sm text-destructive">
                {s.photoNoBarcode}
              </p>
            )}
          </>
        )}

        <form onSubmit={submitTyped} className="flex flex-col gap-1.5 border-t pt-3">
          <label htmlFor={inputId} className="text-sm font-medium">
            {s.typeLabel}
          </label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              placeholder={s.typePlaceholder}
              value={typed}
              aria-invalid={typedError || undefined}
              aria-describedby={typedError ? `${inputId}-error` : undefined}
              onChange={(e) => {
                setTyped(e.target.value)
                setTypedError(false)
              }}
            />
            <Button type="submit">{s.lookUp}</Button>
          </div>
          {typedError && (
            <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
              {s.invalid}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

/** Copies the part of the frame under the guide box into `canvas`, at the video's full resolution. */
function guideCrop(video: HTMLVideoElement, canvas: HTMLCanvasElement): HTMLCanvasElement {
  const region = guideRegion({ width: video.videoWidth, height: video.videoHeight }, { width: video.clientWidth || video.videoWidth, height: video.clientHeight || video.videoHeight })
  if (canvas.width !== region.width || canvas.height !== region.height) {
    canvas.width = region.width
    canvas.height = region.height
  }
  canvas.getContext('2d', { willReadFrequently: true })?.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height)
  return canvas
}
