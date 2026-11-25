import { Link } from 'react-router'

import { progress, type BookView } from '@/domain/bookView'
import { t } from '@/i18n'

import { BookCover } from './BookCover'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'

function authorLine(book: BookView) {
  return book.authorNames.join(', ') || t.common.unknownAuthor
}

export function BookListItem({ book }: { book: BookView }) {
  const p = book.entry.status === 'reading' ? progress(book) : undefined
  return (
    <Link
      to={`/book/${book.entry.id}`}
      className="flex min-h-11 gap-3 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <BookCover url={book.edition.coverUrl} title={book.edition.title} className="w-12" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="truncate font-medium">{book.edition.title}</span>
        <span className="truncate text-sm text-muted-foreground">{authorLine(book)}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={book.entry.status} />
          {p !== undefined && (
            <div className="w-24">
              <ProgressBar value={p} label={t.common.pageOf(book.currentPage, book.edition.pageCount)} />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function BookGridItem({ book }: { book: BookView }) {
  return (
    <Link
      to={`/book/${book.entry.id}`}
      className="flex flex-col gap-1.5 rounded-lg p-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <BookCover url={book.edition.coverUrl} title={book.edition.title} className="w-full" />
      <span className="line-clamp-2 text-sm leading-tight font-medium">{book.edition.title}</span>
      <span className="truncate text-xs text-muted-foreground">{authorLine(book)}</span>
    </Link>
  )
}
