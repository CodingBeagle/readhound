import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

const AUTO_HIDE_MS = 5000

/**
 * Registers the service worker (auto-update) and tells the user once the app
 * shell is cached for offline use. The notice hides itself after a few
 * seconds so it never sits on top of a form's main button.
 */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    const id = setTimeout(() => setOfflineReady(false), AUTO_HIDE_MS)
    return () => clearTimeout(id)
  }, [offlineReady, setOfflineReady])

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
