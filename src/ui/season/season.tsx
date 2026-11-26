import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { useDemo, useServices } from '@/app/services'
import { isDecember, msUntilRecheck, SETTING_DEMO_DECEMBER } from '@/domain/season'

const FestiveContext = createContext(false)

/** True while Zico is dressed for December. Outside the provider (tests, icons) he never is. */
// oxlint-disable-next-line react/only-export-components
export function useFestive(): boolean {
  return useContext(FestiveContext)
}

/**
 * Turns December mode on for the whole of December in local time, and in demo
 * mode whenever the demo toggle forces it. It checks the date again around
 * midnight, so an app left open on 30 November puts the hat on by itself.
 */
export function FestiveProvider({ children }: { children: ReactNode }) {
  const { clock } = useServices()
  const demo = useDemo()
  const [december, setDecember] = useState(() => isDecember(clock.now(), clock.timeZone()))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      const now = clock.now()
      setDecember(isDecember(now, clock.timeZone()))
      timer = setTimeout(check, msUntilRecheck(now))
    }
    check()
    return () => clearTimeout(timer)
  }, [clock])
  const forced = useDemoDecember()
  const festive = december || (demo.active && forced === true)
  // CSS hooks for anything seasonal that is pure styling.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-festive', festive)
    return () => document.documentElement.removeAttribute('data-festive')
  }, [festive])
  return <FestiveContext value={festive}>{children}</FestiveContext>
}

/** The demo toggle's value (always false outside demo mode), undefined while loading. */
// oxlint-disable-next-line react/only-export-components
export function useDemoDecember(): boolean | undefined {
  const { db } = useServices()
  const demo = useDemo()
  return useLiveQuery(async () => (demo.active ? (await db.settings.get(SETTING_DEMO_DECEMBER))?.value === true : false), [db, demo.active])
}

/** Saves the demo toggle. It lives in the demo database, so the real library never sees it. */
// oxlint-disable-next-line react/only-export-components
export function useSetDemoDecember() {
  const { db } = useServices()
  const demo = useDemo()
  return async (on: boolean) => {
    if (!demo.active) return
    if (on) await db.settings.put({ key: SETTING_DEMO_DECEMBER, value: true })
    else await db.settings.delete(SETTING_DEMO_DECEMBER)
  }
}

type Listener = () => void
const snowListeners = new Set<Listener>()

/** Starts a snow shower right away (the demo's "Make it snow" button). */
// oxlint-disable-next-line react/only-export-components
export function letItSnow() {
  snowListeners.forEach((fn) => fn())
}

// oxlint-disable-next-line react/only-export-components
export function onLetItSnow(fn: Listener): () => void {
  snowListeners.add(fn)
  return () => snowListeners.delete(fn)
}
