import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { useServices } from '@/app/services'
import { t } from '@/i18n'
import type { EditionDetails, SearchResult } from '@/sources/types'
import { BookCover } from '@/ui/books/BookCover'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useDebounced, useDelayedFlag, useOnline } from '@/ui/hooks/useDebounced'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

/** Search input is debounced by 400 ms; the loading state appears after 300 ms (design doc). */
const DEBOUNCE_MS = 400
const LOADING_DELAY_MS = 300

export function SearchScreen() {
  const { sources } = useServices()
  const [params, setParams] = useSearchParams()
  const text = params.get('q') ?? ''
  const query = useDebounced(text.trim(), DEBOUNCE_MS)
  const online = useOnline()

  // A changed query gets a new key, and TanStack Query aborts the previous request's signal.
  const search = useQuery({
    queryKey: ['search', query],
    queryFn: ({ signal }) => sources.search({ text: query }, signal),
    enabled: online && query.length >= 2,
  })
  const showLoading = useDelayedFlag(search.isFetching, LOADING_DELAY_MS)
  const manualLink = `/add/manual?title=${encodeURIComponent(query)}`

  return (
    <>
      <ScreenHeader title={t.screens.search.title} />
      <Input
        type="search"
        enterKeyHint="search"
        autoFocus
        aria-label={t.screens.search.label}
        placeholder={t.screens.search.placeholder}
        value={text}
        onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
        className="mb-4"
      />

      {query.length < 2 && (
        <Link to="/for-you" className="surface mb-4 flex min-h-11 items-center gap-2 p-3 text-sm font-medium">
          <Sparkles aria-hidden className="size-4 text-primary" />
          <span className="flex-1">{t.recommendations.searchLink}</span>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
      {!online && <EmptyState>{t.screens.search.offline}</EmptyState>}
      {online && showLoading && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          {t.screens.search.searching}
        </p>
      )}
      {online && search.isError && (
        <EmptyState>
          <p className="mb-3">{t.screens.search.error}</p>
          <Button variant="outline" onClick={() => search.refetch()}>
            {t.screens.search.retry}
          </Button>
        </EmptyState>
      )}

      {search.data?.kind === 'isbn' && (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{t.screens.search.isbnMatch}</p>
          <IsbnResult edition={search.data.edition} />
        </>
      )}
      {search.data?.kind === 'results' && (
        <ul className="flex flex-col gap-1">
          {search.data.results.map((r) => (
            <li key={r.work.id}>
              <WorkResult result={r} />
            </li>
          ))}
        </ul>
      )}
      {search.data?.kind === 'none' && (
        <EmptyState>
          <p className="mb-3">{t.screens.search.noResults(query)}</p>
          <Button asChild>
            <Link to={manualLink}>{t.screens.search.addManually}</Link>
          </Button>
        </EmptyState>
      )}
      {search.data && search.data.kind !== 'none' && (
        <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
          <span>{t.screens.search.notListed}</span>
          <Button asChild variant="outline">
            <Link to={manualLink}>{t.screens.search.addManually}</Link>
          </Button>
        </div>
      )}
    </>
  )
}

function WorkResult({ result }: { result: SearchResult }) {
  const meta = [
    result.firstPublishYear && t.screens.search.firstPublished(result.firstPublishYear),
    t.screens.search.editions(result.editionCount),
  ].filter(Boolean)
  return (
    <Link
      to={`/search/work/${result.work.id}`}
      state={{ result }}
      className="flex min-h-11 gap-3 rounded-lg p-2 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <BookCover url={result.coverUrl} title={result.title} className="w-12" />
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="font-medium">{result.title}</span>
        <span className="truncate text-sm text-muted-foreground">
          {result.authors.map((a) => a.name).join(', ') || t.common.unknownAuthor}
        </span>
        <span className="text-xs text-muted-foreground">{meta.join(' · ')}</span>
      </div>
    </Link>
  )
}

function IsbnResult({ edition }: { edition: EditionDetails }) {
  return (
    <Link
      to="/add"
      state={{ edition }}
      className="flex min-h-11 gap-3 surface p-2 transition-transform active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <BookCover url={edition.coverUrl} title={edition.title} className="w-14" />
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="font-medium">{edition.title}</span>
        <span className="text-sm text-muted-foreground">{edition.authors.map((a) => a.name).join(', ')}</span>
        <span className="text-xs text-muted-foreground">
          {[edition.publishers[0], edition.publishYear, edition.pageCount && t.common.pages(edition.pageCount)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
    </Link>
  )
}
