import type { RouteObject } from 'react-router'

import { AppShell } from '@/ui/layout/AppShell'
import { AddBookScreen } from '@/ui/screens/AddBookScreen'
import { BookScreen } from '@/ui/screens/BookScreen'
import { DemoScreen } from '@/ui/screens/DemoScreen'
import { HomeScreen } from '@/ui/screens/HomeScreen'
import { LibraryScreen } from '@/ui/screens/LibraryScreen'
import { ManualEntryScreen } from '@/ui/screens/ManualEntryScreen'
import { NotFoundScreen } from '@/ui/screens/NotFoundScreen'
import { ProfileScreen } from '@/ui/screens/ProfileScreen'
import { SearchScreen } from '@/ui/screens/SearchScreen'
import { StatsScreen } from '@/ui/screens/StatsScreen'
import { WorkScreen } from '@/ui/screens/WorkScreen'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'search', element: <SearchScreen /> },
      { path: 'search/work/:workId', element: <WorkScreen /> },
      { path: 'add', element: <AddBookScreen /> },
      { path: 'add/manual', element: <ManualEntryScreen /> },
      { path: 'book/:entryId', element: <BookScreen /> },
      { path: 'library', element: <LibraryScreen /> },
      { path: 'stats', element: <StatsScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
      { path: 'demo', element: <DemoScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]
