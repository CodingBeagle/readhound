import { lazy, Suspense } from 'react'
import type { RouteObject } from 'react-router'

import { AppShell } from '@/ui/layout/AppShell'
import { AchievementsScreen } from '@/ui/screens/AchievementsScreen'
import { AddBookScreen } from '@/ui/screens/AddBookScreen'
import { BookScreen } from '@/ui/screens/BookScreen'
import { DemoScreen } from '@/ui/screens/DemoScreen'
import { ForYouScreen } from '@/ui/screens/ForYouScreen'
import { GenreBackfillScreen } from '@/ui/screens/GenreBackfillScreen'
import { IsbnLookupScreen } from '@/ui/screens/IsbnLookupScreen'
import { HomeScreen } from '@/ui/screens/HomeScreen'
import { LibraryScreen } from '@/ui/screens/LibraryScreen'
import { ManualEntryScreen } from '@/ui/screens/ManualEntryScreen'
import { NotFoundScreen } from '@/ui/screens/NotFoundScreen'
import { ProfileScreen } from '@/ui/screens/ProfileScreen'
import { SearchScreen } from '@/ui/screens/SearchScreen'
import { SeriesListScreen } from '@/ui/screens/SeriesListScreen'
import { SeriesScreen } from '@/ui/screens/SeriesScreen'
import { WorkScreen } from '@/ui/screens/WorkScreen'

// The stats screen carries the chart libraries, so it loads on first visit only.
const StatsScreen = lazy(() => import('@/ui/screens/StatsScreen').then((m) => ({ default: m.StatsScreen })))

const YearInReviewScreen = lazy(() => import('@/ui/screens/YearInReviewScreen').then((m) => ({ default: m.YearInReviewScreen })))

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'search', element: <SearchScreen /> },
      { path: 'search/work/:workId', element: <WorkScreen /> },
      { path: 'add', element: <AddBookScreen /> },
      { path: 'add/manual', element: <ManualEntryScreen /> },
      { path: 'add/isbn/:isbn', element: <IsbnLookupScreen /> },
      { path: 'book/:entryId', element: <BookScreen /> },
      { path: 'library', element: <LibraryScreen /> },
      { path: 'series', element: <SeriesListScreen /> },
      { path: 'series/:seriesId', element: <SeriesScreen /> },
      {
        path: 'stats/year/:year',
        element: (
          <Suspense fallback={null}>
            <YearInReviewScreen />
          </Suspense>
        ),
      },
      {
        path: 'stats',
        element: (
          <Suspense fallback={null}>
            <StatsScreen />
          </Suspense>
        ),
      },
      { path: 'profile', element: <ProfileScreen /> },
      { path: 'achievements', element: <AchievementsScreen /> },
      { path: 'for-you', element: <ForYouScreen /> },
      { path: 'genres/suggest', element: <GenreBackfillScreen /> },
      { path: 'demo', element: <DemoScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]
