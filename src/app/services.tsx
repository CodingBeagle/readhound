import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useState, type ReactNode } from 'react'

import { db as defaultDb, IndexedDbCache, LibraryRepository, type ReadhoundDB } from '@/db'
import { createDefaultRegistry, type SourceRegistry } from '@/sources'

export interface Services {
  db: ReadhoundDB
  library: LibraryRepository
  sources: SourceRegistry
}

const ServicesContext = createContext<Services | null>(null)

// oxlint-disable-next-line only-export-components
export function createServices(db: ReadhoundDB = defaultDb): Services {
  return { db, library: new LibraryRepository(db), sources: createDefaultRegistry(new IndexedDbCache(db)) }
}

/** Provides the database, repositories and book sources, plus TanStack Query for Open Library calls. */
export function ServicesProvider({ services, children }: { services?: Services; children: ReactNode }) {
  const [value] = useState(() => services ?? createServices())
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // The HTTP client already retries once and caches responses.
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesContext value={value}>{children}</ServicesContext>
    </QueryClientProvider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useServices must be used inside ServicesProvider')
  return services
}
