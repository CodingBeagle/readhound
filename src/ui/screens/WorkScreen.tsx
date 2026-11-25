import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useServices } from '@/app/services'
import { getSetting } from '@/db/queries'
import { DEFAULT_PREFERRED_LANGUAGES, orderEditions } from '@/domain/editions'
import { t } from '@/i18n'
import type { SearchResult } from '@/sources/types'
import { BackLink } from '@/ui/books/BackLink'
import { BookCover } from '@/ui/books/BookCover'
import { Button } from '@/ui/components/ui/button'
import { useOnline } from '@/ui/hooks/useDebounced'
import { EmptyState } from '@/ui/layout/EmptyState'

/** Work detail with the edition picker. */
export function WorkScreen() {
  const { workId = '' } = useParams()
  const { sources, db } = useServices()
  const result = (useLocation().state as { result?: SearchResult } | null)?.result
  const online = useOnline()

  const editions = useQuery({
    queryKey: ['editions', workId],
    queryFn: () => sources.get('openlibrary')!.listEditions({ source: 'openlibrary', id: workId }),
    enabled: online,
  })
  const preferred = useLiveQuery(() => getSetting(db, 'preferredLanguages', DEFAULT_PREFERRED_LANGUAGES), [db])
  const owned = useLiveQuery(
    async () => new Set((await db.editions.toArray()).flatMap((e) => (e.sourceRef ? [e.sourceRef.id] : []))),
    [db],
  )
  const ordered = useMemo(
    () => orderEditions(editions.data ?? [], preferred ?? DEFAULT_PREFERRED_LANGUAGES),
    [editions.data, preferred],
  )

  const title = result?.title ?? editions.data?.[0]?.title ?? ''
  const authors = result?.authors.map((a) => a.name) ?? editions.data?.[0]?.authors.map((a) => a.name) ?? []
  const fallbackCoverUrl = ordered.find((e) => e.coverUrl)?.coverUrl ?? result?.coverUrl
  const manualLink = `/add/manual?title=${encodeURIComponent(title)}&author=${encodeURIComponent(authors.join(', '))}`

  return (
    <>
      <BackLink />
      <div className="mb-5 flex gap-4">
        <BookCover url={result?.coverUrl} title={title} className="w-20" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl title">{title}</h1>
          <p className="text-muted-foreground">{authors.join(', ')}</p>
          {result?.firstPublishYear && <p className="text-sm">{t.screens.search.firstPublished(result.firstPublishYear)}</p>}
        </div>
      </div>

      <h2 className="text-lg font-semibold">{t.screens.work.chooseEdition}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t.screens.work.chooseHint}</p>

      {!online && <EmptyState>{t.screens.search.offline}</EmptyState>}
      {editions.isPending && online && <p role="status" className="text-sm text-muted-foreground">{t.screens.work.loadingEditions}</p>}
      {editions.isError && <EmptyState>{t.screens.search.error}</EmptyState>}
      {editions.data?.length === 0 && <EmptyState>{t.screens.work.noEditions}</EmptyState>}

      <ul className="flex flex-col gap-1">
        {ordered.map((edition) => (
          <li key={edition.edition.id}>
            <Link
              to="/add"
              state={{ edition, work: result, fallbackCoverUrl }}
              className="flex min-h-11 gap-3 rounded-lg p-2 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BookCover url={edition.coverUrl} title={edition.title} className="w-10" />
              <div className="flex min-w-0 flex-col justify-center gap-0.5">
                <span className="font-medium">{edition.title}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    edition.language?.toUpperCase(),
                    edition.publishers[0],
                    edition.publishYear,
                    edition.pageCount && t.common.pages(edition.pageCount),
                    edition.format,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {owned?.has(edition.edition.id) && <span className="text-xs font-medium">{t.screens.work.inLibrary}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t pt-4">
        <Button asChild variant="outline">
          <Link to={manualLink}>{t.screens.work.cantFind}</Link>
        </Button>
      </div>
    </>
  )
}
