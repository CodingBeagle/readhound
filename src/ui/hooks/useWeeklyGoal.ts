import { useLiveQuery } from 'dexie-react-hooks'

import { useServices } from '@/app/services'
import { parseWeeklyGoal, SETTING_WEEKLY_PAGES_GOAL } from '@/domain/weeklyGoal'

/** The weekly pages target: a number, null when none is set, undefined while loading. */
export function useWeeklyGoal(): number | null | undefined {
  const { db } = useServices()
  return useLiveQuery(async () => parseWeeklyGoal((await db.settings.get(SETTING_WEEKLY_PAGES_GOAL))?.value) ?? null, [db])
}

/** Saves the weekly target; undefined removes it. */
export function useSetWeeklyGoal() {
  const { db } = useServices()
  return async (target: number | undefined) => {
    const valid = parseWeeklyGoal(target)
    if (valid === undefined) await db.settings.delete(SETTING_WEEKLY_PAGES_GOAL)
    else await db.settings.put({ key: SETTING_WEEKLY_PAGES_GOAL, value: valid })
  }
}
