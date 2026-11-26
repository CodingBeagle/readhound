/** Santa hat colours: fixed, like the rest of Zico's artwork. */
const HAT = {
  red: '#dc2626',
  redShade: '#a91d1d',
  redShine: '#f87171',
  fur: '#fffdf8',
  furShade: '#e3ddd6',
} as const

/**
 * Zico's December Santa hat (design doc, Seasonal). It is drawn around its own
 * origin, the middle of the fur brim, about 210 units wide, with the tip
 * flopping to the right. Place it with `transform`; mirror it with a negative x scale.
 * The tip and pom-pom are their own group so CSS can let them bob.
 */
export function SantaHat({ transform }: { transform: string }) {
  return (
    <g className="santa-hat" transform={transform} data-testid="santa-hat">
      <g className="santa-hat-tip">
        <path d="M58 -128c40 4 66 30 78 66c-16-18-36-28-58-28z" fill={HAT.redShade} />
        <circle className="santa-hat-pom" cx="136" cy="-58" r="25" fill={HAT.fur} />
        <path d="M124 -40c10 4 22 2 30-6c-2 12-14 22-28 20z" fill={HAT.furShade} />
      </g>
      <path d="M-92 -8C-86 -88 -34 -140 30 -138c34 1 56 10 70 30c-30-4-44 4-30 30c10 20 18 46 18 70z" fill={HAT.red} />
      {/* A soft fold on the left and a highlight, so the hat has some volume. */}
      <path d="M-70 -14c4-48 26-86 60-106c-24 30-36 66-38 106z" fill={HAT.redShade} opacity="0.5" />
      <path d="M2 -126c22-6 46-2 60 10c-20-4-40-2-60 4z" fill={HAT.redShine} opacity="0.75" />
      <rect x="-106" y="-32" width="212" height="48" rx="24" fill={HAT.fur} />
      <path d="M-100 0c30 10 170 10 200 0v4c0 8-10 12-22 12h-156c-12 0-22-4-22-12z" fill={HAT.furShade} />
      {/* Fluffy bumps along the brim. */}
      <g fill={HAT.fur}>
        <circle cx="-84" cy="-30" r="10" />
        <circle cx="-44" cy="-34" r="11" />
        <circle cx="0" cy="-35" r="11" />
        <circle cx="44" cy="-34" r="11" />
        <circle cx="84" cy="-30" r="10" />
      </g>
    </g>
  )
}
