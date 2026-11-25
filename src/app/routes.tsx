import type { RouteObject } from 'react-router'

import { AppShell } from '@/ui/layout/AppShell'
import { HomeScreen } from '@/ui/screens/HomeScreen'
import { LibraryScreen } from '@/ui/screens/LibraryScreen'
import { NotFoundScreen } from '@/ui/screens/NotFoundScreen'
import { ProfileScreen } from '@/ui/screens/ProfileScreen'
import { SearchScreen } from '@/ui/screens/SearchScreen'
import { StatsScreen } from '@/ui/screens/StatsScreen'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'search', element: <SearchScreen /> },
      { path: 'library', element: <LibraryScreen /> },
      { path: 'stats', element: <StatsScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]
