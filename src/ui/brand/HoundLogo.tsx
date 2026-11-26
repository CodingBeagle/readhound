import { useId } from 'react'

import { cn } from '@/lib/utils'

import { HOUND_VIEWBOX, houndColors as c, houndShapes as s } from './houndArt'

type Props = {
  /** `badge` is the app icon (gradient tile); `mark` is just the hound and its book. */
  variant?: 'badge' | 'mark'
  /**
   * `idle`: blinks now and then and flops its ears when hovered or tapped.
   * `peek`: also rises from behind the book when it appears (empty states, splash).
   * `sniff`: bobs while something loads.
   */
  motion?: 'none' | 'idle' | 'peek' | 'sniff'
  /** Decorative by default; pass a label when the logo is the only content of a link. */
  label?: string
  className?: string
}

/** Zico, the Readhound beagle, drawn from the shared artwork in `houndArt.ts` (design doc, Brand). */
export function HoundLogo({ variant = 'badge', motion = 'idle', label, className }: Props) {
  const gradientId = useId()
  const [from, via, to] = c.gradient
  return (
    <svg
      viewBox={`0 0 ${HOUND_VIEWBOX} ${HOUND_VIEWBOX}`}
      className={cn('hound shrink-0', motion !== 'none' && `hound-${motion}`, className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="hound-logo"
    >
      {variant === 'badge' && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={from} />
              <stop offset="0.55" stopColor={via} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
          </defs>
          <rect width={HOUND_VIEWBOX} height={HOUND_VIEWBOX} rx={112} fill={`url(#${gradientId})`} />
        </>
      )}
      <g className="hound-head">
        <path d={s.head} fill={c.fur} />
        <path d={s.blaze} fill={c.cream} />
        <ellipse {...s.muzzle} fill={c.cream} />
        <path className="hound-ear hound-ear-left" d={s.earLeft} fill={c.ear} />
        <path className="hound-ear hound-ear-right" d={s.earRight} fill={c.ear} />
        <g className="hound-eyes">
          {s.eyes.map((e) => (
            <g key={e.cx}>
              <circle cx={e.cx} cy={e.cy} r={s.eyeRadius} fill={c.ink} />
              <circle cx={e.cx + s.glintOffset.dx} cy={e.cy + s.glintOffset.dy} r={s.glintOffset.r} fill="#fff" />
            </g>
          ))}
        </g>
        <path d={s.nose} fill={c.ink} />
      </g>
      {/* Without the badge behind it, a soft outline keeps the white pages visible on light screens. */}
      <g stroke={variant === 'mark' ? c.spine : undefined} strokeOpacity={0.25} strokeWidth={6} strokeLinejoin="round">
        <path d={s.pageLeft} fill={c.page} />
        <path d={s.pageRight} fill={c.pageShade} />
      </g>
      <path d={s.spine} stroke={c.spine} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
      <g className="hound-paws">
        {s.paws.map((p) => (
          <ellipse key={p.cx} {...p} {...s.pawSize} fill={c.cream} />
        ))}
        <path d={s.toes} stroke={c.fur} strokeWidth={4} strokeLinecap="round" />
      </g>
    </svg>
  )
}
