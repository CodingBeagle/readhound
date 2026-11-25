import { RotateCcw } from 'lucide-react'

import { t } from '@/i18n'
import { BackLink } from '@/ui/books/BackLink'
import { Button } from '@/ui/components/ui/button'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'
import { PickList } from '@/ui/recommendations/PickList'
import { TasteSummary } from '@/ui/recommendations/TasteSummary'
import { usePickActions, useRecommendations, type RecommendationsState } from '@/ui/recommendations/useRecommendations'

const r = t.recommendations

/** Book suggestions from the reader's taste profile (design doc, Recommendations). */
export function ForYouScreen() {
  const state = useRecommendations()
  const actions = usePickActions()

  return (
    <>
      <BackLink />
      <ScreenHeader title={r.title} />
      <p className="-mt-3 mb-4 text-sm text-muted-foreground">{r.intro}</p>
      {state.status !== 'loading' && state.profile && <TasteSummary profile={state.profile} className="mb-5" />}
      <Body state={state} />
      {state.status === 'ready' && state.dismissedCount > 0 && (
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => void actions.resetDismissed()}>
          <RotateCcw aria-hidden />
          {r.resetDismissed(state.dismissedCount)}
        </Button>
      )}
    </>
  )
}

function Body({ state }: { state: RecommendationsState }) {
  switch (state.status) {
    case 'loading':
      return (
        <p role="status" className="text-sm text-muted-foreground">
          {r.loading}
        </p>
      )
    case 'needRatings':
      return <EmptyState>{r.needRatings}</EmptyState>
    case 'offline':
      return <EmptyState>{r.offline}</EmptyState>
    case 'error':
      return (
        <EmptyState>
          <p className="mb-3">{r.error}</p>
          <Button variant="outline" onClick={state.retry}>
            {r.retry}
          </Button>
        </EmptyState>
      )
    case 'ready':
      return state.picks.length === 0 ? <EmptyState>{r.noPicks}</EmptyState> : <PickList picks={state.picks} />
  }
}
