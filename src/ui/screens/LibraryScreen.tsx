import { t } from '@/i18n'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function LibraryScreen() {
  return (
    <>
      <ScreenHeader title={t.screens.library.title} />
      <EmptyState>{t.screens.library.empty}</EmptyState>
    </>
  )
}
