import { t } from '@/i18n'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function StatsScreen() {
  return (
    <>
      <ScreenHeader title={t.screens.stats.title} />
      <EmptyState>{t.screens.stats.empty}</EmptyState>
    </>
  )
}
