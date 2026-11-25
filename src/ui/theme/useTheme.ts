import { useSyncExternalStore } from 'react'

import { readStoredTheme, saveTheme, subscribeTheme, type ThemeId } from './themes'

/** The current theme and a setter that saves it for this device. */
export function useTheme(): [ThemeId, (theme: ThemeId) => void] {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, readStoredTheme)
  return [theme, saveTheme]
}
