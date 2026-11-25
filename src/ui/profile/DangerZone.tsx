import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { useDemo, useServices } from '@/app/services'
import { clearEverything } from '@/db/backup'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { Field, Input } from '@/ui/components/ui/input'
import { useBackup } from '@/ui/hooks/useBackup'

const d = t.screens.profile.danger

/**
 * Deletes everything in the library on this device (design doc, Danger zone).
 * It sits behind an export offer and a typed confirmation, and is hidden in
 * demo mode so it can only ever clear the real library on purpose.
 */
export function DangerZone() {
  const { db } = useServices()
  const demo = useDemo()
  const backup = useBackup()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const confirmed = typed.trim().toUpperCase() === d.word

  function start() {
    setMessage(undefined)
    setOpen(true)
  }

  function cancel() {
    setOpen(false)
    setTyped('')
  }

  async function wipe() {
    setBusy(true)
    try {
      await clearEverything(db)
      cancel()
      setMessage(d.done)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="danger-zone" className="mt-10 mb-6">
      <h2 id="danger-zone" className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-destructive uppercase">
        <TriangleAlert aria-hidden className="size-4" />
        {d.title}
      </h2>
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border-2 border-destructive/60 bg-destructive/5 p-4 text-sm">
        {demo.active ? (
          <p>{d.demo}</p>
        ) : (
          <>
            <p>{d.intro}</p>
            <p className="text-muted-foreground">{d.keeps}</p>
            {!open ? (
              <Button variant="outline" className="self-start border-destructive/60 text-destructive hover:bg-destructive/10" onClick={start}>
                {d.start}
              </Button>
            ) : (
              <div className="animate-rise flex flex-col gap-3 border-t border-destructive/30 pt-3">
                <div className="flex flex-col gap-1.5">
                  <p className="font-medium">{d.exportFirst}</p>
                  <Button variant="outline" className="self-start" onClick={() => void backup.exportJson()}>
                    {t.screens.profile.backup.exportJson}
                  </Button>
                </div>
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (confirmed && !busy) void wipe()
                  }}
                >
                  <Field label={d.typeToConfirm(d.word)}>
                    <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="destructive" disabled={!confirmed || busy}>
                      {d.confirm}
                    </Button>
                    <Button type="button" variant="ghost" onClick={cancel}>
                      {t.common.cancel}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
        <p role="status" className="min-h-4 text-xs font-medium">
          {message}
        </p>
      </div>
    </section>
  )
}
