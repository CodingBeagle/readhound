import { useId } from 'react'

import { houndShapes as s } from './houndArt'

/**
 * Pyjama colours: fixed, like the rest of Zico's artwork. In December he wears
 * his Christmas pyjamas (red with cream stripes and green trim) under the
 * Santa hat, which stands in for his nightcap.
 */
// oxlint-disable-next-line react/only-export-components
export const PYJAMAS = {
  everyday: { base: '#5b7fd1', shade: '#4665ad', stripe: '#dfe8fb', trim: '#2f4a8a', pom: '#fffdf8' },
  christmas: { base: '#c62828', shade: '#9f1f1f', stripe: '#fff3ea', trim: '#15803d', pom: '#fffdf8' },
} as const

export type PyjamaColors = (typeof PYJAMAS)[keyof typeof PYJAMAS]

// oxlint-disable-next-line react/only-export-components
export const pyjamaColors = (festive: boolean): PyjamaColors => (festive ? PYJAMAS.christmas : PYJAMAS.everyday)

/**
 * Zico's striped nightcap, the bedtime twin of `SantaHat`: drawn around the
 * same origin (the middle of the brim, about 210 units wide) with the long tip
 * flopping down to the right, so it goes on with the same transforms.
 * The tip is its own group so CSS can let it sway.
 */
export function Nightcap({ transform }: { transform: string }) {
  const clip = useId()
  const pj = PYJAMAS.everyday
  const cap = 'M-96 -10C-92 -92 -40 -142 32 -140c66 2 110 40 128 112c4 18 4 34 0 46c-12-36-34-62-62-72c4 18 4 38 2 44z'
  return (
    <g className="nightcap" transform={transform} data-testid="nightcap">
      <defs>
        <clipPath id={clip}>
          <path d={cap} />
        </clipPath>
      </defs>
      <path d={cap} fill={pj.base} />
      <g clipPath={`url(#${clip})`} fill={pj.stripe}>
        {[-80, -32, 16, 64, 112].map((x) => (
          <path key={x} d={`M${x} 20l60-180h18l-60 180z`} />
        ))}
        {/* A soft shadow along the left fold gives the cap some volume. */}
        <path d="M-96 -10C-92 -92 -40 -142 32 -140c-50 20-84 70-90 130z" fill={pj.shade} opacity="0.45" />
      </g>
      <g className="nightcap-tip">
        <circle cx="162" cy="24" r="22" fill={pj.pom} />
        <path d="M146 36c8 6 22 6 32-2c-4 12-16 18-28 16z" fill="#e3ddd6" />
      </g>
      <rect x="-104" y="-30" width="208" height="40" rx="20" fill={pj.trim} />
      <path d="M-96 -12h192" stroke={pj.stripe} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
    </g>
  )
}

/**
 * Pyjama sleeves for the front-facing artwork (logo and Home buddy): striped
 * forearms resting on the book, ending in a cuff just above each paw. Drawn
 * after the book and before the paws, so the paws sit on the cuffs.
 */
export function PyjamaSleeves({ festive }: { festive: boolean }) {
  const pj = pyjamaColors(festive)
  return (
    <g className="pyjama-sleeves" data-testid="pyjamas">
      {s.paws.map((p) => (
        <g key={p.cx}>
          <rect x={p.cx - 36} y={p.cy - 46} width={72} height={48} rx={22} fill={pj.base} />
          <path d={`M${p.cx - 14} ${p.cy - 44}v40M${p.cx + 14} ${p.cy - 44}v40`} stroke={pj.stripe} strokeWidth={8} strokeLinecap="round" />
          <rect x={p.cx - 37} y={p.cy - 20} width={74} height={18} rx={9} fill={pj.trim} />
        </g>
      ))}
    </g>
  )
}
