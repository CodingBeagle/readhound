import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'

import { useServices } from '@/app/services'
import { achievements, type AchievementSummary } from '@/domain/achievements'
import { useStatsModel } from '@/ui/hooks/useStats'

/** Every achievement, live as reading is logged. `undefined` while loading. */
export function useAchievements(): AchievementSummary | undefined {
  const { db } = useServices()
  const model = useStatsModel()
  const goals = useLiveQuery(() => db.goals.toArray(), [db])
  return useMemo(() => (model && goals ? achievements({ model, goals }) : undefined), [model, goals])
}
