import { t } from '@/i18n'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function SearchScreen() {
  return (
    <>
      <ScreenHeader title={t.screens.search.title} />
      <input
        type="search"
        aria-label={t.screens.search.placeholder}
        placeholder={t.screens.search.placeholder}
        disabled
        className="mb-4 h-11 w-full rounded-md border bg-card px-3 text-base placeholder:text-muted-foreground disabled:opacity-60"
      />
      <EmptyState>{t.screens.search.comingSoon}</EmptyState>
    </>
  )
}
