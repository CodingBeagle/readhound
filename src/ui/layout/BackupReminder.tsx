import { HardDriveDownload } from 'lucide-react'

import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { useBackup } from '@/ui/hooks/useBackup'

const r = t.screens.profile.reminder

/** Shown when the last backup is more than 30 days old (design doc, Storage). */
export function BackupReminder() {
  const backup = useBackup()
  if (!backup.due) return null
  return (
    <aside aria-label={r.title} className="mb-5 flex flex-col gap-3 surface p-4 text-sm">
      <div className="flex gap-3">
        <HardDriveDownload aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">{r.title}</p>
          <p className="text-muted-foreground">{r.body}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void backup.exportJson()}>
          {r.action}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void backup.snooze()}>
          {r.later}
        </Button>
      </div>
    </aside>
  )
}
