import { BACKUP_FORMAT, BACKUP_VERSION, restoreBackup } from '@/db/backup'
import { today, type Clock } from '@/db/clock'
import type { ReadhoundDB } from '@/db/schema'

import { buildSampleLibrary } from './sampleLibrary'

/** The demo database's name. Real data lives in `readhound` and is never touched by demo mode. */
export const DEMO_DB_NAME = 'readhound-demo'

/** Replaces everything in `db` with freshly generated sample data. */
export async function seedDemo(db: ReadhoundDB, clock: Clock): Promise<void> {
  if (db.name !== DEMO_DB_NAME && !db.name.startsWith('test-')) throw new Error('Sample data only goes into the demo database.')
  const data = buildSampleLibrary({ today: today(clock), timeZone: clock.timeZone() })
  await restoreBackup(db, { format: BACKUP_FORMAT, version: BACKUP_VERSION, appVersion: 'demo', exportedAt: clock.now().toISOString(), data })
}
