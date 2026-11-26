import { t } from '@/i18n'

import { HoundLogo } from './HoundLogo'

/** Shown while a lazily loaded screen (Stats, Year in review) downloads: the hound sniffs around. */
export function HoundLoader() {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
      <HoundLogo variant="mark" motion="sniff" className="size-20" />
      {t.loading}
    </div>
  )
}
