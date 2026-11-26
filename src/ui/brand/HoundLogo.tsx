import { useId } from 'react'

import { cn } from '@/lib/utils'

import { useAsleep, useBedtime, useFestive } from '@/ui/season/season'

import { HOUND_VIEWBOX, houndColors as c, houndShapes as s, SANTA_HAT_ON_HEAD } from './houndArt'
import { Nightcap, PyjamaSleeves } from './Pyjamas'
import { SantaHat } from './SantaHat'

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
  /** Dresses Zico regardless of the date and hour (the landing page shows off his outfits). */
  outfit?: 'santa' | 'pyjamas'
  className?: string
}

/** Zico, the Readhound beagle, drawn from the shared artwork in `houndArt.ts` (design doc, Brand). */
export function HoundLogo({ variant = 'badge', motion = 'idle', label, outfit, className }: Props) {
  const gradientId = useId()
  const seasonFestive = useFestive()
  const seasonBedtime = useBedtime()
  const festive = outfit ? outfit === 'santa' : seasonFestive
  const bedtime = outfit ? outfit === 'pyjamas' : seasonBedtime
  // Midnight to 06:00 he sleeps in his pyjamas: eyes shut, slow breaths, z's drifting up.
  const seasonAsleep = useAsleep()
  const asleep = !outfit && seasonAsleep
  const [from, via, to] = c.gradient
  return (
    <svg
      viewBox={`0 0 ${HOUND_VIEWBOX} ${HOUND_VIEWBOX}`}
      className={cn('hound shrink-0', motion !== 'none' && `hound-${motion}`, asleep && 'hound-asleep', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="hound-logo"
      data-asleep={asleep || undefined}
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
          {s.eyes.map((e) =>
            asleep ? (
              <path key={e.cx} d={`M${e.cx - 15} ${e.cy}q15 12 30 0`} stroke={c.ink} strokeWidth={9} strokeLinecap="round" fill="none" />
            ) : (
              <g key={e.cx}>
                <circle cx={e.cx} cy={e.cy} r={s.eyeRadius} fill={c.ink} />
                <circle cx={e.cx + s.glintOffset.dx} cy={e.cy + s.glintOffset.dy} r={s.glintOffset.r} fill="#fff" />
              </g>
            ),
          )}
        </g>
        <path d={s.nose} fill={c.ink} />
        {festive ? <SantaHat transform={SANTA_HAT_ON_HEAD} /> : bedtime && <Nightcap transform={SANTA_HAT_ON_HEAD} />}
      </g>
      {/* Without the badge behind it, a soft outline keeps the white pages visible on light screens. */}
      <g stroke={variant === 'mark' ? c.spine : undefined} strokeOpacity={0.25} strokeWidth={6} strokeLinejoin="round">
        <path d={s.pageLeft} fill={c.page} />
        <path d={s.pageRight} fill={c.pageShade} />
      </g>
      <path d={s.spine} stroke={c.spine} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
      {bedtime && <PyjamaSleeves festive={festive} />}
      <g className="hound-paws">
        {s.paws.map((p) => (
          <ellipse key={p.cx} {...p} {...s.pawSize} fill={c.cream} />
        ))}
        <path d={s.toes} stroke={c.fur} strokeWidth={4} strokeLinecap="round" />
      </g>
      {asleep && (
        <g className="hound-zzz" fill={variant === 'badge' ? '#fff' : c.ear} fontWeight={800} fontFamily="inherit" data-testid="hound-zzz">
          <text x={392} y={118} fontSize={44}>z</text>
          <text x={424} y={82} fontSize={56}>z</text>
          <text x={454} y={48} fontSize={66}>Z</text>
        </g>
      )}
    </svg>
  )
}
