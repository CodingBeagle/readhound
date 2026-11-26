import { useSyncExternalStore } from 'react'

/**
 * While a bulk change runs (a Goodreads import), achievement toasts hold
 * back, so the unlocks it causes are announced together at the end instead
 * of one toast per book.
 */
let quiet = false
const listeners = new Set<() => void>()

export function setAchievementsQuiet(on: boolean) {
  if (quiet === on) return
  quiet = on
  for (const listener of listeners) listener()
}

export function useAchievementsQuiet(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => quiet,
  )
}
