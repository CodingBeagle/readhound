import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useDemo } from '@/app/services'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

/** Enter, reset and leave demo mode (sample data in a separate database). */
export function DemoScreen() {
  const demo = useDemo()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()

  async function run(action: () => Promise<void>, done?: string) {
    setBusy(true)
    setMessage(undefined)
    try {
      await action()
      setMessage(done)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ScreenHeader title={t.demo.title} />
      <div className="flex flex-col gap-4">
        <p>{t.demo.intro}</p>
        <p className="flex gap-2 rounded-xl border bg-card p-4 text-sm">
          <ShieldCheck aria-hidden className="size-5 shrink-0" />
          {t.demo.safe}
        </p>
        {demo.active ? (
          <>
            <p className="font-medium">{t.demo.active}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button disabled={busy} onClick={() => void run(demo.reset, t.demo.resetDone)} variant="outline">
                {t.demo.reset}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  demo.leave()
                  navigate('/')
                }}
              >
                {t.demo.leave}
              </Button>
            </div>
          </>
        ) : (
          <Button
            size="lg"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await demo.enter()
                navigate('/')
              })
            }
          >
            {busy ? t.demo.entering : t.demo.enter}
          </Button>
        )}
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      </div>
    </>
  )
}
