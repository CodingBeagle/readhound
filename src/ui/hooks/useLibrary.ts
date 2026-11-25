import { useLiveQuery } from 'dexie-react-hooks'

import { useServices } from '@/app/services'
import type { BookView } from '@/domain/bookView'
import { loadLibrary } from '@/db/queries'

/** All library books, kept live as the database changes. `undefined` while loading. */
export function useLibrary(): BookView[] | undefined {
  const { db } = useServices()
  return useLiveQuery(() => loadLibrary(db), [db])
}
