import { Check, RotateCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CoverPhotoInput } from '@/db'
import { MAX_ZOOM, initialCrop, normalizeCrop, panCrop, rotatedSize, type CropState } from '@/domain/covers'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

import { drawCrop, loadImageFile, renderCover, rotateImage, sourceSize, type ImageSource } from './image'

const c = t.covers
/** Preview size in CSS pixels (2:3). */
const PREVIEW_WIDTH = 220
const PREVIEW_HEIGHT = 330
const KEY_STEP = 12

/**
 * The crop step (design doc, Cover photos): the photo behind a 2:3 frame,
 * moved by dragging or the arrow keys, zoomed by pinching, the slider or the
 * mouse wheel, and turned in quarter turns.
 */
export function CoverCropper({ file, onCancel, onDone }: { file: Blob; onCancel: () => void; onDone: (photo: CoverPhotoInput) => Promise<void> | void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)
  const [turns, setTurns] = useState(0)
  const [saving, setSaving] = useState(false)
  const source = useMemo<ImageSource | null>(() => (image ? rotateImage(image, turns) : null), [image, turns])
  const [crop, setCrop] = useState<CropState | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    loadImageFile(file).then(
      (img) => {
        if (cancelled) return
        setImage(img)
        setCrop(initialCrop(sourceSize(img)))
      },
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
  }, [file])

  useEffect(() => {
    if (!source || !crop || !canvasRef.current) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    drawCrop(canvasRef.current, source, crop, Math.round(PREVIEW_WIDTH * dpr), Math.round(PREVIEW_HEIGHT * dpr))
  }, [source, crop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  const size = source && sourceSize(source)
  const pan = (dx: number, dy: number) => size && setCrop((cur) => cur && panCrop(size, cur, dx, dy, canvasRef.current?.clientWidth || PREVIEW_WIDTH))
  const zoomTo = (zoom: number) => size && setCrop((cur) => cur && normalizeCrop(size, { ...cur, zoom }))

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinch.current = null
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      if (pinch.current && crop) zoomTo(crop.zoom * (distance / pinch.current))
      pinch.current = distance
    } else pan(e.clientX - last.x, e.clientY - last.y)
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId)
    pinch.current = null
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const moves: Record<string, [number, number]> = { ArrowLeft: [KEY_STEP, 0], ArrowRight: [-KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    pan(...move)
  }

  function turn() {
    if (!image) return
    const next = (turns + 1) % 4
    setTurns(next)
    setCrop(initialCrop(rotatedSize(sourceSize(image), next)))
  }

  async function use() {
    if (!source || !crop) return
    setSaving(true)
    try {
      await onDone(renderCover(source, crop))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cover-crop-title" className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="surface flex max-h-full w-full max-w-sm flex-col items-center gap-3 overflow-y-auto bg-background p-4 shadow-xl">
        <h2 id="cover-crop-title" className="title text-lg">
          {c.cropTitle}
        </h2>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {c.unreadable}
          </p>
        ) : (
          <>
            <p className="text-center text-xs text-muted-foreground">{c.cropHint}</p>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="img"
              aria-label={c.preview}
              className="touch-none cursor-grab rounded-md bg-muted shadow-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
              style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, maxWidth: '100%' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(e) => crop && zoomTo(crop.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))}
              onKeyDown={onKeyDown}
            />
            <div className="flex w-full items-center gap-3">
              <label className="flex flex-1 items-center gap-3 text-sm font-medium">
                {c.zoom}
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={crop?.zoom ?? 1}
                  disabled={!crop}
                  onChange={(e) => zoomTo(Number(e.target.value))}
                  className="h-11 flex-1 accent-[var(--chart-1)]"
                />
              </label>
              <Button variant="outline" size="icon" aria-label={c.rotate} disabled={!source} onClick={turn}>
                <RotateCw />
              </Button>
            </div>
          </>
        )}
        <div className="flex w-full gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={saving}>
            {t.common.cancel}
          </Button>
          {!failed && (
            <Button className="flex-1" onClick={use} disabled={!crop || saving}>
              <Check />
              {saving ? c.saving : c.use}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
