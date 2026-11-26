import { useEffect, useState } from 'react'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/ui/motion/bookAddedConfetti'
import { onBookAdded, playBark, primeBarkAudio } from '@/ui/motion/bookAddedBark'

import { houndColors as c } from './houndArt'

/** Darker fur for the far legs, so the trot reads as four legs, not two. */
const FAR_FUR = '#a8672f'

/** Timeline of one visit, in ms: trot in, stop and bark, trot off. */
export const WALK_IN_MS = 1200
export const BARK_MS = 1400
export const WALK_OUT_MS = 1100
/** With reduced motion the beagle just appears, barks and fades. */
export const STILL_MS = 1900

type Phase = 'in' | 'bark' | 'out'

/**
 * The Readhound beagle, full body and side on, trotting along the bottom of
 * the screen when a book is added (design doc, Animation). It walks in from
 * the left, stops in the middle, barks twice with a "Woof!" bubble and trots
 * off to the right. It is decorative: it never takes taps or focus.
 */
export function BarkingBeagle() {
  const [visit, setVisit] = useState(0)
  const [phase, setPhase] = useState<Phase | null>(null)
  const [still, setStill] = useState(false)

  useEffect(
    () =>
      onBookAdded(() => {
        const reduce = prefersReducedMotion()
        setStill(reduce)
        setPhase(reduce ? 'bark' : 'in')
        setVisit((n) => n + 1)
        if (reduce) playBark()
      }),
    [],
  )

  // Browsers that only start audio from a gesture: wake it on the tap that adds the book.
  useEffect(() => {
    const prime = () => primeBarkAudio()
    window.addEventListener('pointerdown', prime, { capture: true })
    window.addEventListener('keydown', prime, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', prime, { capture: true })
      window.removeEventListener('keydown', prime, { capture: true })
    }
  }, [])

  // Each visit restarts the timeline, so books added in quick succession get one beagle, not a pack.
  useEffect(() => {
    if (!visit) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    if (still) {
      at(STILL_MS, () => setPhase(null))
    } else {
      at(WALK_IN_MS, () => {
        setPhase('bark')
        playBark()
      })
      at(WALK_IN_MS + BARK_MS, () => setPhase('out'))
      at(WALK_IN_MS + BARK_MS + WALK_OUT_MS, () => setPhase(null))
    }
    return () => timers.forEach(clearTimeout)
  }, [visit, still])

  if (!phase) return null
  return (
    <div aria-hidden className="barker-lane pointer-events-none fixed inset-x-0 z-50 h-44 overflow-hidden" data-testid="barking-beagle">
      <div key={visit} className={cn('barker', still ? 'barker-still' : `barker-${phase}`)} data-phase={phase}>
        {phase === 'bark' && <span className="barker-bubble">{t.bark.woof}</span>}
        <WalkingHound />
      </div>
    </div>
  )
}

/** The beagle side on, facing right, on a 240 × 150 canvas. Parts are classed so CSS can trot them. */
export function WalkingHound({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" className={cn('walker overflow-visible', className)}>
      <ellipse className="walker-shadow" cx="112" cy="141" rx="72" ry="6" fill="currentColor" opacity="0.14" />
      <g className="walker-body">
        {/* Far legs first, so the body covers their tops. */}
        <g className="walker-leg walker-leg-far-back">
          <rect x="64" y="86" width="14" height="48" rx="7" fill={FAR_FUR} />
          <ellipse cx="73" cy="134" rx="10" ry="5" fill="#f1dcc4" />
        </g>
        <g className="walker-leg walker-leg-far-front">
          <rect x="134" y="86" width="14" height="48" rx="7" fill={FAR_FUR} />
          <ellipse cx="143" cy="134" rx="10" ry="5" fill="#f1dcc4" />
        </g>
        <g className="walker-tail">
          <path d="M62 74C46 66 38 50 38 28" stroke={c.fur} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M39 38C38 33 38 30 38 26" stroke={c.cream} strokeWidth="10" strokeLinecap="round" fill="none" />
        </g>
        <ellipse cx="104" cy="82" rx="54" ry="27" fill={c.fur} />
        {/* The dark saddle and cream belly of a tricolour beagle. */}
        <path d="M70 62c18-12 52-14 74-4c-6 14-26 20-44 20s-30-6-30-16z" fill={c.ear} />
        <ellipse cx="108" cy="98" rx="38" ry="10" fill={c.cream} />
        <g className="walker-leg walker-leg-near-back">
          <rect x="74" y="88" width="15" height="48" rx="7.5" fill={c.fur} />
          <ellipse cx="83" cy="136" rx="11" ry="5.5" fill={c.cream} />
        </g>
        <g className="walker-leg walker-leg-near-front">
          <rect x="124" y="88" width="15" height="48" rx="7.5" fill={c.fur} />
          <ellipse cx="133" cy="136" rx="11" ry="5.5" fill={c.cream} />
        </g>
        <g className="walker-head">
          <path d="M136 74c4-18 12-30 22-36l16 10c-6 12-14 24-22 34z" fill={c.fur} />
          <circle cx="166" cy="48" r="26" fill={c.fur} />
          <path d="M166 24c4 0 8 2 9 4l-3 26h-10z" fill={c.cream} />
          <ellipse cx="188" cy="60" rx="20" ry="14" fill={c.cream} />
          <path className="walker-mouth" d="M180 68c8 6 18 6 24 0c-2 8-8 12-13 12s-9-4-11-12z" fill={c.ink} />
          <ellipse cx="205" cy="54" rx="7" ry="5.5" fill={c.ink} />
          <circle cx="172" cy="42" r="4.6" fill={c.ink} />
          <circle cx="173.6" cy="40.4" r="1.6" fill="#fff" />
          <path className="walker-ear" d="M156 30c-10 0-16 10-16 26c0 16 4 28 11 28c8 0 11-14 11-30c0-12-2-20-6-24z" fill={c.ear} />
        </g>
      </g>
    </svg>
  )
}
