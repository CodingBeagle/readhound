import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { t } from '@/i18n'
import { ChipToggle } from '@/ui/components/ChipToggle'
import { useCollections } from '@/ui/hooks/useCollections'

const b = t.screens.book

/** List and category chips for a book in the library; changes save at once. */
export function Organise({ entryId, categoryIds }: { entryId: string; categoryIds: readonly string[] }) {
  const { collections } = useServices()
  const data = useCollections()
  if (!data) return null
  const inList = new Set(data.listItems.filter((i) => i.entryId === entryId).map((i) => i.listId))
  return (
    <CollectionPicker
      lists={data.lists}
      categories={data.categories}
      listIds={inList}
      categoryIds={new Set(categoryIds)}
      onList={(id, on) => (on ? collections.addToList(id, entryId) : collections.removeFromList(id, entryId))}
      onCategory={(id, on) => collections.toggleCategory(entryId, id, on)}
    />
  )
}

/** The chips themselves, shared by the book screen and the add screen. */
export function CollectionPicker(props: {
  lists: readonly { id: string; name: string }[]
  categories: readonly { id: string; name: string }[]
  listIds: ReadonlySet<string>
  categoryIds: ReadonlySet<string>
  onList: (id: string, on: boolean) => unknown
  onCategory: (id: string, on: boolean) => unknown
  /** Hide the "manage in Profile" hint when there is nothing to pick. */
  quiet?: boolean
}) {
  const { lists, categories, listIds, categoryIds, onList, onCategory, quiet } = props
  if (lists.length === 0 && categories.length === 0)
    return quiet ? null : (
      <p className="text-sm text-muted-foreground">
        {b.noCollections}{' '}
        <Link to="/profile" className="font-medium text-foreground underline underline-offset-4">
          {b.manageCollections}
        </Link>
      </p>
    )
  return (
    <div className="flex flex-col gap-3">
      {lists.length > 0 && (
        <div role="group" aria-label={b.lists} className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-medium text-muted-foreground">{b.lists}</span>
          {lists.map((l) => (
            <ChipToggle key={l.id} pressed={listIds.has(l.id)} onClick={() => onList(l.id, !listIds.has(l.id))}>
              {l.name}
            </ChipToggle>
          ))}
        </div>
      )}
      {categories.length > 0 && (
        <div role="group" aria-label={b.categories} className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-medium text-muted-foreground">{b.categories}</span>
          {categories.map((c) => (
            <ChipToggle key={c.id} pressed={categoryIds.has(c.id)} onClick={() => onCategory(c.id, !categoryIds.has(c.id))}>
              {c.name}
            </ChipToggle>
          ))}
        </div>
      )}
    </div>
  )
}
