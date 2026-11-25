import { Layers, LayoutGrid, List } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { filterBooks, sortBooks, type LibrarySort } from '@/domain/bookView'
import type { Status } from '@/domain/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { BookGridItem, BookListItem } from '@/ui/books/BookListItem'
import { Button } from '@/ui/components/ui/button'
import { Input, Select } from '@/ui/components/ui/input'
import { useCollections } from '@/ui/hooks/useCollections'
import { useLibrary } from '@/ui/hooks/useLibrary'
import { useSeriesNames } from '@/ui/hooks/useSeries'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

const STATUS_FILTERS: { value: Status | ''; label: string }[] = [
  { value: '', label: t.screens.library.all },
  { value: 'to_read', label: t.status.to_read },
  { value: 'reading', label: t.status.reading },
  { value: 'finished', label: t.status.finished },
  { value: 'dnf', label: t.screens.library.dnfPile },
]
const SORTS = Object.entries(t.screens.library.sorts) as [LibrarySort, string][]

export function LibraryScreen() {
  const books = useLibrary()
  // Filters live in the URL so they survive navigating to a book and back.
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as Status | ''
  const sort = (params.get('sort') ?? 'added') as LibrarySort
  const view = params.get('view') === 'grid' ? 'grid' : 'list'
  const text = params.get('q') ?? ''
  const language = params.get('lang') ?? ''
  const listId = params.get('list') ?? ''
  const categoryId = params.get('cat') ?? ''
  const seriesId = params.get('series') ?? ''
  const owned = params.get('owned') === '1'
  const collections = useCollections()
  const seriesNames = useSeriesNames()

  const set = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )

  const languages = useMemo(
    () => [...new Set((books ?? []).map((b) => b.edition.language).filter((l): l is string => Boolean(l)))].sort(),
    [books],
  )
  const listEntryIds = useMemo(
    () => (listId && collections ? new Set(collections.listItems.filter((i) => i.listId === listId).map((i) => i.entryId)) : undefined),
    [listId, collections],
  )
  const shown = useMemo(
    () =>
      books
        ? sortBooks(
            filterBooks(books, {
              status: status || undefined,
              text,
              language: language || undefined,
              categoryId: categoryId || undefined,
              listEntryIds,
              seriesId: seriesId || undefined,
              owned,
            }),
            sort,
          )
        : [],
    [books, status, text, language, categoryId, listEntryIds, seriesId, owned, sort],
  )

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <ScreenHeader title={t.screens.library.title} />
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/series">
            <Layers />
            {t.series.libraryLink}
          </Link>
        </Button>
      </div>
      <div role="group" aria-label={t.screens.book.statusLabel} className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={status === f.value ? 'default' : 'outline'}
            aria-pressed={status === f.value}
            onClick={() => set('status', f.value)}
            className="rounded-full"
          >
            {f.label}
          </Button>
        ))}
        {/* Owned combines with any status: Owned + To read is the shelf of books I own but haven't read. */}
        <span aria-hidden className="my-1 w-px shrink-0 bg-border" />
        <Button size="sm" variant={owned ? 'default' : 'outline'} aria-pressed={owned} onClick={() => set('owned', owned ? '' : '1')} className="rounded-full">
          {t.owned.filter}
        </Button>
      </div>
      <Input
        type="search"
        aria-label={t.screens.library.filter}
        placeholder={t.screens.library.filter}
        value={text}
        onChange={(e) => set('q', e.target.value)}
        className="mb-2"
      />
      {collections && (collections.lists.length > 0 || collections.categories.length > 0) && (
        <div className="mb-2 flex gap-2">
          {collections.lists.length > 0 && (
            <Select aria-label={t.screens.library.listFilter} value={listId} onChange={(e) => set('list', e.target.value)} className="min-w-0 flex-1">
              <option value="">{t.screens.library.anyList}</option>
              {collections.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
          {collections.categories.length > 0 && (
            <Select aria-label={t.screens.library.categoryFilter} value={categoryId} onChange={(e) => set('cat', e.target.value)} className="min-w-0 flex-1">
              <option value="">{t.screens.library.anyCategory}</option>
              {collections.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
      {seriesNames && seriesNames.length > 0 && (
        <Select aria-label={t.series.filter} value={seriesId} onChange={(e) => set('series', e.target.value)} className="mb-2">
          <option value="">{t.series.anySeries}</option>
          {seriesNames.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      )}
      <div className="mb-4 flex gap-2">
        <Select aria-label={t.screens.library.sort} value={sort} onChange={(e) => set('sort', e.target.value)} className="min-w-0 flex-1">
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {languages.length > 1 && (
          <Select aria-label={t.screens.book.language} value={language} onChange={(e) => set('lang', e.target.value)} className="w-28 shrink-0">
            <option value="">{t.screens.book.language}</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        )}
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label={view === 'grid' ? t.screens.library.list : t.screens.library.grid}
          onClick={() => set('view', view === 'grid' ? '' : 'grid')}
        >
          {view === 'grid' ? <List /> : <LayoutGrid />}
        </Button>
      </div>

      {books && books.length === 0 && <EmptyState>{t.screens.library.empty}</EmptyState>}
      {books && books.length > 0 && shown.length === 0 && <EmptyState>{t.screens.library.noMatches}</EmptyState>}
      {shown.length > 0 && (
        <>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {t.screens.library.count(shown.length)}
          </p>
          <ul className={cn(view === 'grid' ? 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5' : 'flex flex-col gap-1')}>
            {shown.map((book) => (
              <li key={book.entry.id}>{view === 'grid' ? <BookGridItem book={book} /> : <BookListItem book={book} />}</li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
