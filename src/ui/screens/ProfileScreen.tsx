import { t } from '@/i18n'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function ProfileScreen() {
  return (
    <>
      <ScreenHeader title={t.screens.profile.title} />
      <EmptyState>{t.screens.profile.description}</EmptyState>
    </>
  )
}
