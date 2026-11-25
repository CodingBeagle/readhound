import { Lock } from 'lucide-react'

import type { Family, Special, Tier } from '@/domain/achievements'
import { cn } from '@/lib/utils'

import { ACHIEVEMENT_ICONS } from './icons'

/** A round medal in its tier's metal, with the achievement's icon. Locked medals are a dashed outline. */
export function Medal({
  achievement,
  tier,
  size = 'md',
  shine = false,
  className,
}: {
  achievement: Family | Special
  /** Undefined = locked. */
  tier?: Tier | 'special'
  size?: 'sm' | 'md' | 'lg'
  shine?: boolean
  className?: string
}) {
  const Icon = ACHIEVEMENT_ICONS[achievement]
  const box = size === 'lg' ? 'size-20' : size === 'sm' ? 'size-9' : 'size-12'
  const icon = size === 'lg' ? 'size-9' : size === 'sm' ? 'size-4' : 'size-5'
  return (
    <span
      aria-hidden
      className={cn(
        'medal relative grid shrink-0 place-items-center rounded-full',
        box,
        tier ? `medal-${tier} text-[#2a1d0e]` : 'border-2 border-dashed border-muted-foreground/40 bg-muted text-muted-foreground',
        shine && tier && 'medal-shine',
        className,
      )}
    >
      <Icon className={cn(icon, 'relative drop-shadow-sm')} strokeWidth={2.25} />
      {!tier && size !== 'sm' && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-background text-muted-foreground">
          <Lock className="size-3" />
        </span>
      )}
    </span>
  )
}
