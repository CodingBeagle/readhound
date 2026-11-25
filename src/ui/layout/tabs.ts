import { ChartColumn, House, LibraryBig, Search, User, type LucideIcon } from 'lucide-react'

import { t } from '@/i18n'

export interface Tab {
  to: string
  label: string
  icon: LucideIcon
}

/** The five top-level tabs from the design doc's Screens section, in order. */
export const tabs: Tab[] = [
  { to: '/', label: t.tabs.home, icon: House },
  { to: '/search', label: t.tabs.search, icon: Search },
  { to: '/library', label: t.tabs.library, icon: LibraryBig },
  { to: '/stats', label: t.tabs.stats, icon: ChartColumn },
  { to: '/profile', label: t.tabs.profile, icon: User },
]
