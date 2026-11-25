import { LayoutGrid, List } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { filterBooks, sortBooks, type LibrarySort } from '@/domain/bookView'
import type { Status } from '@/domain/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { BookGridItem, BookListItem } from '@/ui/books/BookListItem'
import { Button } from '@/ui/components/ui/button'
import { Input, Select } from '@/ui/components/ui/input'
import { useLibrary } from '@/ui/hooks/useLibrary'
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
  const shown = useMemo(
    () => (books ? sortBooks(filterBooks(books, { status: status || undefined, text, language: language || undefined }), sort) : []),
    [books, status, text, language, sort],
  )

  return (
    <>
      <ScreenHeader title={t.screens.library.title} />
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
      </div>
      <Input
        type="search"
        aria-label={t.screens.library.filter}
        placeholder={t.screens.library.filter}
        value={text}
        onChange={(e) => set('q', e.target.value)}
        className="mb-2"
      />
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
