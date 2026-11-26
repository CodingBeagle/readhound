import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { useDemo, useServices } from '@/app/services'
import { bedtimePhase, demoBedtimePhase, isDecember, msUntilBedtimeChange, msUntilRecheck, SETTING_DEMO_DECEMBER, SETTING_DEMO_PYJAMAS, type BedtimePhase } from '@/domain/season'

const FestiveContext = createContext(false)
const BedtimeContext = createContext<BedtimePhase>('day')

/** True while Zico is dressed for December. Outside the provider (tests, icons) he never is. */
// oxlint-disable-next-line react/only-export-components
export function useFestive(): boolean {
  return useContext(FestiveContext)
}

/** True while Zico is in his pyjamas (18:00 to 06:00). Outside the provider he never is. */
// oxlint-disable-next-line react/only-export-components
export function useBedtime(): boolean {
  return useContext(BedtimeContext) !== 'day'
}

/** True while Zico is fast asleep (midnight to 06:00). Outside the provider he never is. */
// oxlint-disable-next-line react/only-export-components
export function useAsleep(): boolean {
  return useContext(BedtimeContext) === 'night'
}

/** The bedtime phase itself: day, evening (pyjamas) or night (asleep). */
// oxlint-disable-next-line react/only-export-components
export function useBedtimePhase(): BedtimePhase {
  return useContext(BedtimeContext)
}

/**
 * Follows a test on the local clock, checking again when `wait` says it may
 * have changed, and whenever the app comes back to the screen (a phone that
 * slept through 18:00 may have held the timer back).
 */
function useLocalClock<T>(test: (now: Date, timeZone: string) => T, wait: (now: Date, timeZone: string) => number): T {
  const { clock } = useServices()
  const [value, setValue] = useState(() => test(clock.now(), clock.timeZone()))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      clearTimeout(timer)
      const now = clock.now()
      setValue(test(now, clock.timeZone()))
      timer = setTimeout(check, wait(now, clock.timeZone()))
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [clock, test, wait])
  return value
}

/** Sets or clears an attribute on <html>, as a CSS hook for anything seasonal that is pure styling. */
function useRootFlag(name: string, on: boolean) {
  useEffect(() => {
    document.documentElement.toggleAttribute(name, on)
    return () => document.documentElement.removeAttribute(name)
  }, [name, on])
}

/**
 * Dresses Zico for the season and the hour. December mode is on for the whole
 * of December in local time (checked again around midnight), pyjama time from
 * 18:00 to 06:00 (checked again just after each switch). In demo mode either
 * can also be forced on by its demo toggle.
 */
export function FestiveProvider({ children }: { children: ReactNode }) {
  const demo = useDemo()
  const december = useLocalClock(isDecember, msUntilRecheck)
  const clockPhase = useLocalClock(bedtimePhase, msUntilBedtimeChange)
  const forcedDecember = useDemoDecember()
  const forcedPyjamas = useDemoPyjamas()
  const festive = december || (demo.active && forcedDecember === true)
  const forcedPhase = demo.active ? forcedPyjamas : undefined
  // A demo phase only ever adds bedtime: forcing evening at 02:00 still leaves him asleep.
  const phase: BedtimePhase = clockPhase === 'night' || forcedPhase === 'night' ? 'night' : clockPhase === 'evening' || forcedPhase ? 'evening' : 'day'
  useRootFlag('data-festive', festive)
  useRootFlag('data-bedtime', phase !== 'day')
  useRootFlag('data-asleep', phase === 'night')
  return (
    <FestiveContext value={festive}>
      <BedtimeContext value={phase}>{children}</BedtimeContext>
    </FestiveContext>
  )
}

/** A demo-only switch's value (always false outside demo mode), undefined while loading. */
function useDemoSwitch(key: string): boolean | undefined {
  const { db } = useServices()
  const demo = useDemo()
  return useLiveQuery(async () => (demo.active ? (await db.settings.get(key))?.value === true : false), [db, demo.active, key])
}

/** Saves a demo-only switch. It lives in the demo database, so the real library never sees it. */
function useSetDemoSwitch(key: string) {
  const { db } = useServices()
  const demo = useDemo()
  return async (on: boolean) => {
    if (!demo.active) return
    if (on) await db.settings.put({ key, value: true })
    else await db.settings.delete(key)
  }
}

/** The December demo toggle's value (always false outside demo mode), undefined while loading. */
// oxlint-disable-next-line react/only-export-components
export const useDemoDecember = () => useDemoSwitch(SETTING_DEMO_DECEMBER)
// oxlint-disable-next-line react/only-export-components
export const useSetDemoDecember = () => useSetDemoSwitch(SETTING_DEMO_DECEMBER)
/**
 * The bedtime phase the demo forces: 'evening' (pyjamas), 'night' (asleep), or
 * null for the real clock (always null outside demo mode); undefined while loading.
 */
// oxlint-disable-next-line react/only-export-components
export function useDemoPyjamas(): 'evening' | 'night' | null | undefined {
  const { db } = useServices()
  const demo = useDemo()
  return useLiveQuery(async () => (demo.active ? (demoBedtimePhase((await db.settings.get(SETTING_DEMO_PYJAMAS))?.value) ?? null) : null), [db, demo.active])
}

/** Saves the demo bedtime phase (null for the real clock), in the demo database only. */
// oxlint-disable-next-line react/only-export-components
export function useSetDemoPyjamas() {
  const { db } = useServices()
  const demo = useDemo()
  return async (phase: 'evening' | 'night' | null) => {
    if (!demo.active) return
    if (phase) await db.settings.put({ key: SETTING_DEMO_PYJAMAS, value: phase })
    else await db.settings.delete(SETTING_DEMO_PYJAMAS)
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
