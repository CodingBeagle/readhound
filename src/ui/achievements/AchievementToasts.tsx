import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useServices } from '@/app/services'
import type { Family, Special, Tier, Unlock } from '@/domain/achievements'
import { t } from '@/i18n'
import { ConfettiBurst } from '@/ui/motion/Celebration'

import { Medal } from './Medal'
import { useAchievements } from './useAchievements'

const a = t.achievements

/** Settings key for what has already been celebrated, so each unlock is announced once. */
export const SETTING_ACHIEVEMENTS_SEEN = 'achievementsSeen'
interface Seen {
  ids: string[]
  level: number
}

type Toast =
  | { kind: 'unlock'; key: string; achievement: Family | Special; tier: Tier | 'special' }
  | { kind: 'level'; key: string; name: string }
  | { kind: 'welcome'; key: string; count: number }

const SHOW_MS = 4200

/**
 * Announces new achievements and level-ups as they happen, one toast at a time
 * with a medal shine and confetti. The first time it runs on a library it
 * marks everything already earned as seen and says hello instead, so an
 * import or demo mode doesn't fire dozens of toasts.
 */
export function AchievementToasts() {
  const { db } = useServices()
  const summary = useAchievements()
  const seen = useLiveQuery(async () => ((await db.settings.get(SETTING_ACHIEVEMENTS_SEEN))?.value as Seen | undefined) ?? null, [db])
  const celebrated = useRef<Set<string> | null>(null)
  const level = useRef(0)
  const [queue, setQueue] = useState<Toast[]>([])
  const [burst, setBurst] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (!summary || seen === undefined) return
    const ids = summary.unlocks.map((u) => u.id)
    if (celebrated.current === null) {
      if (seen === null) {
        celebrated.current = new Set(ids)
        level.current = summary.level.index
        void db.settings.put({ key: SETTING_ACHIEVEMENTS_SEEN, value: { ids, level: summary.level.index } satisfies Seen })
        if (ids.length > 0) setQueue((q) => [...q, { kind: 'welcome', key: 'welcome', count: ids.length }])
        return
      }
      celebrated.current = new Set(seen.ids)
      level.current = seen.level
    }
    const known = celebrated.current
    const fresh = summary.unlocks.filter((u) => !known.has(u.id)).sort(byPoints)
    const levelUp = summary.level.index > level.current
    if (fresh.length === 0 && !levelUp) return
    for (const u of fresh) known.add(u.id)
    level.current = Math.max(level.current, summary.level.index)
    void db.settings.put({ key: SETTING_ACHIEVEMENTS_SEEN, value: { ids: [...known], level: level.current } satisfies Seen })
    setQueue((q) => [
      ...q,
      ...fresh.map((u): Toast => ({ kind: 'unlock', key: u.id, achievement: u.achievement, tier: u.tier })),
      ...(levelUp ? [{ kind: 'level', key: `level-${summary.level.index}`, name: a.levels[summary.level.name] } satisfies Toast] : []),
    ])
  }, [summary, seen, db])

  const current = queue[0]
  useEffect(() => {
    if (!current) return
    if (current.kind !== 'welcome') setBurst((n) => n + 1)
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS)
    return () => clearTimeout(timer)
  }, [current])

  return (
    <>
      <ConfettiBurst burst={burst} />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex justify-center px-4">
        <AnimatePresence mode="wait">
          {current && (
            <motion.button
              key={current.key}
              type="button"
              onClick={() => {
                setQueue((q) => q.slice(1))
                navigate('/achievements')
              }}
              className="surface pointer-events-auto flex w-full max-w-sm items-center gap-3 p-3 text-left shadow-xl"
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              <ToastBody toast={current} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

function ToastBody({ toast }: { toast: Toast }) {
  if (toast.kind === 'unlock') {
    const isFamily = toast.tier !== 'special'
    const name = isFamily ? a.families[toast.achievement as Family].name : a.specials[toast.achievement as Special].name
    return (
      <>
        <motion.span initial={{ rotate: -30, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}>
          <Medal achievement={toast.achievement} tier={toast.tier} shine />
        </motion.span>
        <span className="flex min-w-0 flex-col">
          <span className="text-xs font-medium text-muted-foreground">{a.toast}</span>
          <span className="font-semibold">
            {name}
            {isFamily && <span className="font-normal text-muted-foreground"> · {a.tiers[toast.tier]}</span>}
          </span>
          {!isFamily && <span className="text-xs text-muted-foreground">{a.specials[toast.achievement as Special].description}</span>}
        </span>
      </>
    )
  }
  if (toast.kind === 'level')
    return (
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-muted-foreground">{a.toastLevel}</span>
        <span className="title text-lg">{a.toastLevelBody(toast.name)}</span>
      </span>
    )
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{a.toastWelcomeTitle}</span>
      <span className="text-sm text-muted-foreground">{a.toastWelcome(toast.count)}</span>
    </span>
  )
}

const byPoints = (x: Unlock, y: Unlock) => y.points - x.points
