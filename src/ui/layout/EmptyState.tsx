import type { ReactNode } from 'react'

import { HoundLogo } from '@/ui/brand/HoundLogo'

/** A dashed box with the hound peeking over its book, for screens with nothing to show yet. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      <HoundLogo variant="mark" motion="peek" className="mb-3 size-20" />
      <div>{children}</div>
    </div>
  )
}
