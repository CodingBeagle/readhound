import { useLiveQuery } from 'dexie-react-hooks'

import { useServices } from '@/app/services'
import type { Category, List, ListItem } from '@/domain/types'

export interface Collections {
  /** In the user's order. */
  lists: List[]
  /** Alphabetical. */
  categories: Category[]
  listItems: ListItem[]
}

/** Lists, categories and list memberships, kept live. `undefined` while loading. */
export function useCollections(): Collections | undefined {
  const { db } = useServices()
  return useLiveQuery(async () => {
    const [lists, categories, listItems] = await Promise.all([db.lists.orderBy('sortOrder').toArray(), db.categories.toArray(), db.listItems.toArray()])
    categories.sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' }))
    return { lists, categories, listItems }
  }, [db])
}
