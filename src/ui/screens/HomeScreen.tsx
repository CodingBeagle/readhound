import { t } from '@/i18n'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function HomeScreen() {
  return (
    <>
      <ScreenHeader title={t.screens.home.title} />
      <EmptyState>{t.screens.home.empty}</EmptyState>
    </>
  )
}
