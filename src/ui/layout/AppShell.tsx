import { motion, MotionConfig } from 'motion/react'
import { NavLink, Outlet, useLocation } from 'react-router'

import { useServices } from '@/app/services'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { AchievementToasts } from '@/ui/achievements/AchievementToasts'

import { DemoBanner } from './DemoBanner'
import { tabs } from './tabs'

/**
 * Mobile-first shell: a bottom tab bar on phones that becomes a side bar from
 * the `md` breakpoint up. The active tab's highlight slides between tabs, and
 * each screen eases in when you arrive (design doc, Animation).
 */
function Indicator({ id, className }: { id: string; className: string }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden
      className={cn('tab-indicator absolute bg-[var(--indicator)] bg-[image:var(--indicator)]', className)}
      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
    />
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const { db } = useServices()
  // Screens under a tab (a book, an edition list) share the tab's key, so only real screen changes animate.
  const screenKey = pathname.split('/').slice(0, 3).join('/')
  return (
    <MotionConfig reducedMotion="user">
      {/* Keyed by database, so switching to demo mode starts a fresh celebration record. */}
      <AchievementToasts key={db.name} />
      <div className="min-h-dvh md:flex">
        <nav
          aria-label={t.mainNav}
          className={cn(
            'tabbar fixed inset-x-0 bottom-0 z-10 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg',
            'md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:border-t-0 md:border-r md:pb-0',
          )}
        >
          <div className="title hidden px-5 py-6 text-xl md:block">{t.appName}</div>
          <ul className="flex md:flex-col md:gap-1 md:px-3">
            {tabs.map(({ to, label, icon: Icon }) => (
              <li key={to} className="flex-1 md:flex-none">
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'tab group relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors',
                      'md:min-h-11 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm',
                      'hover:text-foreground',
                      isActive && 'font-semibold text-[var(--indicator-ink)]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Sidebar: the highlight fills the row. */}
                      {isActive && <Indicator id="tab-indicator-side" className="inset-0 rounded-[calc(var(--radius)-4px)] max-md:hidden" />}
                      {/* Tab bar: the highlight is a pill behind the icon. */}
                      <span className="relative grid h-8 w-14 place-items-center md:contents">
                        {isActive && <Indicator id="tab-indicator" className="inset-0 rounded-full md:hidden" />}
                        <Icon aria-hidden className="relative size-5 transition-transform duration-200 group-active:scale-90" />
                      </span>
                      <span className={cn('relative', isActive && 'max-md:text-foreground')}>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-8">
          <DemoBanner />
          <motion.div key={screenKey} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  )
}
