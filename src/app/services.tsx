import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { CollectionsRepository, db as defaultDb, IndexedDbCache, LibraryRepository, ReadhoundDB, SeriesRepository, systemClock, type Clock } from '@/db'
import { DEMO_DB_NAME, seedDemo } from '@/demo/seed'
import { createDefaultRegistry, createSeriesDetector, type SeriesDetector, type SourceRegistry } from '@/sources'

export interface Services {
  db: ReadhoundDB
  library: LibraryRepository
  collections: CollectionsRepository
  series: SeriesRepository
  sources: SourceRegistry
  /** Finds the series of a book on Wikidata and Open Library. */
  seriesDetector: SeriesDetector
  clock: Clock
}

/** Demo mode swaps in a separate database full of sample data (see `demo/`). */
export interface DemoControl {
  active: boolean
  /** Switches to the demo database, filling it with sample data the first time. */
  enter(): Promise<void>
  /** Back to the real library. */
  leave(): void
  /** Throws away the demo data and generates it again. */
  reset(): Promise<void>
}

const ServicesContext = createContext<Services | null>(null)
const DemoContext = createContext<DemoControl | null>(null)

const DEMO_FLAG = 'readhound.demo'

function readDemoFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === '1'
  } catch {
    return false
  }
}

function writeDemoFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(DEMO_FLAG, '1')
    else localStorage.removeItem(DEMO_FLAG)
  } catch {
    // Without storage, demo mode just doesn't survive a reload.
  }
}

// oxlint-disable-next-line only-export-components
export function createServices(db: ReadhoundDB = defaultDb, clock: Clock = systemClock): Services {
  const cache = new IndexedDbCache(db)
  const sources = createDefaultRegistry(cache)
  return {
    db,
    clock,
    library: new LibraryRepository(db, clock),
    collections: new CollectionsRepository(db, clock),
    series: new SeriesRepository(db, clock),
    sources,
    seriesDetector: createSeriesDetector(sources, cache),
  }
}

/**
 * Provides the database, repositories and book sources, plus TanStack Query
 * for Open Library calls. Tests pass their own `services` and a throwaway
 * `demoDbName`.
 */
export function ServicesProvider({ services, demoDbName = DEMO_DB_NAME, children }: { services?: Services; demoDbName?: string; children: ReactNode }) {
  const [real] = useState(() => services ?? createServices())
  const [value, setValue] = useState(() => (!services && readDemoFlag() ? { ...createServices(new ReadhoundDB(demoDbName), real.clock), sources: real.sources, seriesDetector: real.seriesDetector } : real))
  const active = value !== real
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // The HTTP client already retries once and caches responses.
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 },
        },
      }),
  )

  // Reopening the app in demo mode: refill the demo database if the browser cleared it.
  useEffect(() => {
    if (!active) return
    void value.db.entries.count().then((n) => (n === 0 ? seedDemo(value.db, value.clock) : undefined))
  }, [active, value])

  const demo: DemoControl = {
    active,
    async enter() {
      if (active) return
      const demoDb = new ReadhoundDB(demoDbName)
      if ((await demoDb.entries.count()) === 0) await seedDemo(demoDb, real.clock)
      writeDemoFlag(true)
      setValue({ ...createServices(demoDb, real.clock), sources: real.sources, seriesDetector: real.seriesDetector })
    },
    leave() {
      writeDemoFlag(false)
      setValue(real)
    },
    async reset() {
      if (active) await seedDemo(value.db, value.clock)
    },
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DemoContext value={demo}>
        <ServicesContext value={value}>{children}</ServicesContext>
      </DemoContext>
    </QueryClientProvider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useServices must be used inside ServicesProvider')
  return services
}

// oxlint-disable-next-line react/only-export-components
export function useDemo(): DemoControl {
  const demo = useContext(DemoContext)
  if (!demo) throw new Error('useDemo must be used inside ServicesProvider')
  return demo
}
