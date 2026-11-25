import { useLiveQuery } from 'dexie-react-hooks'

import { useServices } from '@/app/services'
import { createBackup, libraryCsv, markBackedUp, readsCsv, SETTING_BACKUP_SNOOZE, SETTING_LAST_BACKUP } from '@/db/backup'
import { getSetting, loadLibrary } from '@/db/queries'
import { addDays, BACKUP_SNOOZE_DAYS, isBackupDue } from '@/domain/backup'
import { localDate } from '@/domain/dates'
import { downloadText } from '@/ui/lib/download'

/** Backup state (last export, whether the reminder is due) and the export actions. */
export function useBackup() {
  const { db, clock, collections } = useServices()
  const state = useLiveQuery(async () => {
    const [lastBackupAt, snoozedUntil, oldest] = await Promise.all([
      getSetting<string | undefined>(db, SETTING_LAST_BACKUP, undefined),
      getSetting<string | undefined>(db, SETTING_BACKUP_SNOOZE, undefined),
      db.entries.orderBy('addedAt').first(),
    ])
    return { lastBackupAt, due: isBackupDue({ now: clock.now(), lastBackupAt, snoozedUntil, oldestAddedAt: oldest?.addedAt }) }
  }, [db, clock])

  const stamp = () => localDate(clock.now(), clock.timeZone())

  return {
    lastBackupAt: state?.lastBackupAt,
    due: state?.due ?? false,
    async exportJson() {
      const backup = await createBackup(db, clock, __APP_VERSION__)
      downloadText(`readhound-backup-${stamp()}.json`, JSON.stringify(backup, null, 1), 'application/json')
      await markBackedUp(db, clock)
    },
    async exportLibraryCsv() {
      const [books, lists, listItems, categories] = await Promise.all([loadLibrary(db), db.lists.toArray(), db.listItems.toArray(), db.categories.toArray()])
      downloadText(`readhound-library-${stamp()}.csv`, libraryCsv(books, lists, listItems, categories), 'text/csv;charset=utf-8')
    },
    async exportReadsCsv() {
      const [books, sessions] = await Promise.all([loadLibrary(db), db.sessions.toArray()])
      downloadText(`readhound-reads-${stamp()}.csv`, readsCsv(books, sessions), 'text/csv;charset=utf-8')
    },
    snooze: () => collections.setSetting(SETTING_BACKUP_SNOOZE, addDays(clock.now(), BACKUP_SNOOZE_DAYS).toISOString()),
  }
}
