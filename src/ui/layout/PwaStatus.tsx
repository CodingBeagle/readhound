import { useRegisterSW } from 'virtual:pwa-register/react'

import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

/**
 * Registers the service worker (auto-update) and tells the user once the app
 * shell is cached for offline use.
 */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW()

  if (!offlineReady) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-20 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg md:right-4 md:bottom-4 md:left-auto md:w-80"
    >
      <span>{t.pwa.offlineReady}</span>
      <Button size="sm" variant="ghost" onClick={() => setOfflineReady(false)}>
        {t.pwa.dismiss}
      </Button>
    </div>
  )
}
