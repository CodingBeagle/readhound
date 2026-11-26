import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'

import { useServices } from '@/app/services'
import { loadQuotes, parseQuoteSettings, SETTING_BUDDY_QUOTES, type QuoteData, type QuoteSettings } from '@/domain/quotes'

/** The buddy's quote settings; undefined while loading. */
export function useQuoteSettings(): QuoteSettings | undefined {
  const { db } = useServices()
  return useLiveQuery(async () => parseQuoteSettings((await db.settings.get(SETTING_BUDDY_QUOTES))?.value), [db])
}

/** Saves the buddy's quote settings. */
export function useSaveQuoteSettings() {
  const { db } = useServices()
  return (settings: QuoteSettings) => db.settings.put({ key: SETTING_BUDDY_QUOTES, value: settings })
}

/** The bundled quote book, loaded on first use; undefined until it is loaded or while `enabled` is false. */
export function useQuoteData(enabled: boolean): QuoteData | undefined {
  return useQuery({ queryKey: ['quotes'], queryFn: loadQuotes, enabled, staleTime: Infinity, gcTime: Infinity }).data
}
