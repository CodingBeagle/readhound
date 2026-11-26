import { Camera, Flashlight, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { t } from '@/i18n'
import { isbnFromBarcode, parseIsbn } from '@/sources/isbn'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'

import { createBarcodeReader, type BarcodeReader } from './detector'

const s = t.scan
/** Time between two reads of the video. Fast enough to feel instant, slow enough to spare the battery. */
const SCAN_INTERVAL_MS = 150

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
  const [torch, setTorch] = useState<{ track: MediaStreamTrack; on: boolean } | null>(null)
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
    const stop = () => stream?.getTracks().forEach((track) => track.stop())

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return setCamera('noCamera')
      // Ask for the camera while the reader loads; both take a moment.
      const [loaded, opened] = await Promise.allSettled([
        getReader(),
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
      ])
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
      const track = stream.getVideoTracks()[0]
      // A torch the camera may offer (Chrome on Android); not in the DOM typings yet.
      if (track && (track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) setTorch({ track, on: false })

      const tick = async () => {
        if (stopped || done.current) return
        if (el.readyState >= el.HAVE_CURRENT_DATA) {
          try {
            const codes = await barcodes.detect(el)
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
      const codes = await (await getReader()).detect(file)
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
    if (!torch) return
    const on = !torch.on
    try {
      await torch.track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      setTorch({ ...torch, on })
    } catch {
      setTorch(null)
    }
  }

  const cameraMessage = CAMERA_MESSAGES[camera]
  const offerPhoto = camera === 'denied' || camera === 'noCamera' || camera === 'failed'

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
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
              <video ref={video} aria-label={s.video} muted playsInline autoPlay className="size-full object-cover" />
              {/* The frame to aim at: wide and short, the shape of a book barcode. */}
              <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[38%] -translate-y-1/2 rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-x-2 top-1/2 h-0.5 bg-primary motion-safe:animate-pulse" />
              </div>
              {camera === 'starting' && (
                <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white">
                  {s.starting}
                </p>
              )}
              {torch && (
                <Button type="button" size="sm" variant={torch.on ? 'default' : 'secondary'} aria-pressed={torch.on} className="absolute right-2 bottom-2" onClick={toggleTorch}>
                  <Flashlight />
                  {s.torch}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{s.hint}</p>
            {wrongCode && (
              <p role="status" className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {s.notIsbn}
              </p>
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
              {s.photo}
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
