import { Link } from 'react-router'

import { progress } from '@/domain/bookView'
import { t } from '@/i18n'
import { BookCover } from '@/ui/books/BookCover'
import { LogPageForm } from '@/ui/books/LogPageForm'
import { ProgressBar } from '@/ui/books/ProgressBar'
import { Button } from '@/ui/components/ui/button'
import { useLibrary } from '@/ui/hooks/useLibrary'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function HomeScreen() {
  const books = useLibrary()
  const reading = books?.filter((b) => b.entry.status === 'reading')

  return (
    <>
      <ScreenHeader title={t.screens.home.title} />
      {reading && reading.length === 0 && (
        <EmptyState>
          <p className="mb-3">{t.screens.home.empty}</p>
          <Button asChild variant="outline">
            <Link to="/search">{t.screens.home.findBook}</Link>
          </Button>
        </EmptyState>
      )}
      <ul className="flex flex-col gap-4">
        {reading?.map((book) => {
          const p = progress(book)
          return (
            <li key={book.entry.id} className="rounded-lg border bg-card p-4">
              <Link to={`/book/${book.entry.id}`} className="mb-3 flex gap-3">
                <BookCover url={book.edition.coverUrl} title={book.edition.title} className="w-16" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">{book.edition.title}</span>
                  <span className="text-sm text-muted-foreground">{book.authorNames.join(', ')}</span>
                  <span className="text-sm">{t.common.pageOf(book.currentPage, book.edition.pageCount)}</span>
                </div>
              </Link>
              {p !== undefined && (
                <div className="mb-3">
                  <ProgressBar value={p} label={t.common.pageOf(book.currentPage, book.edition.pageCount)} />
                </div>
              )}
              <LogPageForm book={book} />
            </li>
          )
        })}
      </ul>
    </>
  )
}
