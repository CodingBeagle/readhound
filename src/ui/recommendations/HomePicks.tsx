import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'

import { PickList } from './PickList'
import { useRecommendations } from './useRecommendations'

const r = t.recommendations

/** The top three picks on Home. Shown only once there are picks, so a new or offline library sees nothing extra. */
export function HomePicks({ className }: { className?: string }) {
  const state = useRecommendations(3)
  if (state.status !== 'ready' || state.picks.length === 0) return null
  return (
    <section aria-labelledby="home-picks" className={cn('animate-rise', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="home-picks" className="text-lg font-semibold">
          {r.homeTitle}
        </h2>
        <Link to="/for-you" className="flex min-h-11 items-center gap-0.5 text-sm font-medium">
          {r.seeAll}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
      <PickList picks={state.picks} compact />
    </section>
  )
}
