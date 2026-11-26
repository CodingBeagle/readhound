import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router'

import { useServices } from '@/app/services'
import { t } from '@/i18n'
import { parseIsbn } from '@/sources/isbn'
import { BackLink } from '@/ui/books/BackLink'
import { Button } from '@/ui/components/ui/button'
import { useOnline } from '@/ui/hooks/useDebounced'
import { EmptyState } from '@/ui/layout/EmptyState'

const s = t.scan

/** The manual entry form with the ISBN filled in, for books the catalog doesn't know. */
const manualIsbnLink = (isbn: string, notFound = false) => `/add/manual?isbn=${isbn}${notFound ? '&notFound=1' : ''}`

/**
 * Looks up a scanned or typed ISBN (design doc, Barcode scanning). The exact
 * edition goes straight to the add step; an ISBN no source knows (common for
 * Danish books on Open Library) opens manual entry with the ISBN filled in.
 */
export function IsbnLookupScreen() {
  const isbn = parseIsbn(useParams().isbn ?? '')
  const { sources } = useServices()
  const online = useOnline()
  const navigate = useNavigate()
  const lookup = useQuery({
    queryKey: ['isbn', isbn],
    queryFn: () => sources.lookupIsbn(isbn!),
    enabled: online && !!isbn,
    retry: false,
  })

  if (!isbn) return <Navigate to="/search" replace />
  if (lookup.data) return <Navigate to="/add" replace state={{ edition: lookup.data.edition }} />
  if (lookup.data === null) return <Navigate to={manualIsbnLink(isbn, true)} replace />

  const scanAgain = () => navigate('/search?scan=1', { replace: true })
  return (
    <>
      <BackLink />
      {!online ? (
        <EmptyState>
          <p className="mb-3">{s.offline}</p>
          <Button onClick={() => navigate(manualIsbnLink(isbn), { replace: true })}>{s.addManually}</Button>
        </EmptyState>
      ) : lookup.isError ? (
        <EmptyState>
          <p className="mb-3">{s.error}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => lookup.refetch()}>{s.retry}</Button>
            <Button variant="outline" onClick={() => navigate(manualIsbnLink(isbn), { replace: true })}>
              {s.addManually}
            </Button>
          </div>
        </EmptyState>
      ) : (
        <EmptyState>
          <p role="status" className="mb-3">
            {s.looking(isbn)}
          </p>
          <Button variant="outline" onClick={scanAgain}>
            {s.scanAgain}
          </Button>
        </EmptyState>
      )}
    </>
  )
}
