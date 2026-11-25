/** Backup reminder rule (design doc, Storage): remind when the last export is more than 30 days old. */
export const BACKUP_REMINDER_DAYS = 30
/** "Remind me later" hides the reminder for this many days. */
export const BACKUP_SNOOZE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/**
 * Whether to show the backup reminder. Before the first export, the clock
 * starts when the first book was added, so a brand new library isn't nagged
 * on day one. An empty library never needs a backup.
 */
export function isBackupDue(input: {
  now: Date
  lastBackupAt?: string
  oldestAddedAt?: string
  snoozedUntil?: string
}): boolean {
  const { now, lastBackupAt, oldestAddedAt, snoozedUntil } = input
  if (!oldestAddedAt) return false
  if (snoozedUntil && now < new Date(snoozedUntil)) return false
  const since = new Date(lastBackupAt ?? oldestAddedAt)
  return now.getTime() - since.getTime() > BACKUP_REMINDER_DAYS * DAY_MS
}
