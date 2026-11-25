import { NavLink, Outlet } from 'react-router'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'

import { DemoBanner } from './DemoBanner'
import { tabs } from './tabs'

/**
 * Mobile-first shell: a bottom tab bar on phones that becomes a side bar from
 * the `md` breakpoint up.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label={t.mainNav}
        className={cn(
          'fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
          'md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:border-t-0 md:border-r md:pb-0',
        )}
      >
        <div className="hidden px-5 py-6 text-lg font-semibold tracking-tight md:block">{t.appName}</div>
        <ul className="flex md:flex-col md:gap-1 md:px-3">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1 md:flex-none">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors',
                    'md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-md md:px-3 md:text-sm',
                    'hover:text-foreground md:hover:bg-muted',
                    isActive && 'text-foreground md:bg-muted',
                  )
                }
              >
                <Icon aria-hidden className="size-5" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-8">
        <DemoBanner />
        <Outlet />
      </main>
    </div>
  )
}
