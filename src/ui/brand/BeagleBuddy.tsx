import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useServices } from '@/app/services'
import { today as todayOf } from '@/db/clock'
import { buddyState, hashOf, type BuddyMood } from '@/domain/buddy'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { useAchievements } from '@/ui/achievements/useAchievements'
import { useWeeklyGoal } from '@/ui/hooks/useWeeklyGoal'
import { useStatsModel } from '@/ui/hooks/useStats'
import { celebrateBookAdded } from '@/ui/motion/bookAddedConfetti'

import { buddyMessage } from './buddyMessages'
import { HOUND_VIEWBOX, houndColors as c, houndShapes as s } from './houndArt'

const b = t.buddy

/** Settings key for the milestones the buddy has already cheered, so each one gets confetti once. */
export const SETTING_BUDDY_CELEBRATED = 'buddyCelebrated'
const KEEP_CELEBRATED = 60
/** How long a tapped sleepy buddy stays awake. */
const AWAKE_MS = 4000
/** With a weekly goal the buddy moves on to another comment on the week this often. */
export const CHATTER_MS = 20_000

/**
 * The beagle buddy on Home (design doc, Beagle buddy): its mood follows the
 * reader's reading, it says something in a speech bubble, and it cheers with
 * confetti once per fresh milestone. Tapping it gets a reaction, and wakes it
 * up for a moment when it is sleepy.
 */
export function BeagleBuddy({ className }: { className?: string }) {
  const { db, clock } = useServices()
  const model = useStatsModel()
  const summary = useAchievements()
  const goals = useLiveQuery(() => db.goals.toArray(), [db])
  const celebrated = useLiveQuery(async () => ((await db.settings.get(SETTING_BUDDY_CELEBRATED))?.value as string[] | undefined) ?? [], [db])
  const weeklyTarget = useWeeklyGoal()
  const today = todayOf(clock)
  const reduce = useReducedMotion()
  const state = useMemo(
    () =>
      model && goals && summary && weeklyTarget !== undefined
        ? buddyState({ model, goals, unlocks: summary.unlocks, today, weeklyTarget: weeklyTarget ?? undefined })
        : undefined,
    [model, goals, summary, today, weeklyTarget],
  )
  const [chatter, setChatter] = useState(0)
  const talksAboutWeek = Boolean(state?.weekly) && !state?.milestone
  useEffect(() => {
    if (!talksAboutWeek) return
    const timer = setInterval(() => setChatter((n) => n + 1), CHATTER_MS)
    return () => clearInterval(timer)
  }, [talksAboutWeek])
  const [pokes, setPokes] = useState(0)
  const [poke, setPoke] = useState(0)
  const [awake, setAwake] = useState(false)
  const [cheer, setCheer] = useState(false)
  const cheered = useRef<string | null>(null)

  const milestoneKey = state?.milestone?.key
  useEffect(() => {
    if (!milestoneKey || !celebrated || cheered.current === milestoneKey || celebrated.includes(milestoneKey)) return
    cheered.current = milestoneKey
    void db.settings.put({ key: SETTING_BUDDY_CELEBRATED, value: [...celebrated, milestoneKey].slice(-KEEP_CELEBRATED) })
    setCheer(true)
    // Achievements already get their own toast with confetti; the buddy just jumps for those.
    if (state?.milestone?.kind !== 'achievement') void celebrateBookAdded()
  }, [milestoneKey, celebrated, db, state?.milestone?.kind])

  useEffect(() => {
    if (!cheer) return
    const timer = setTimeout(() => setCheer(false), 1800)
    return () => clearTimeout(timer)
  }, [cheer])

  useEffect(() => {
    if (!awake) return
    const timer = setTimeout(() => setAwake(false), AWAKE_MS)
    return () => clearTimeout(timer)
  }, [awake])

  if (!state) return null
  // A new band, or a new page count, gets a fresh comment; so does every chatter tick.
  const seed = hashOf(`${today}:${state.mood}:${milestoneKey ?? ''}:${state.weekly?.band ?? ''}`) + (state.weekly?.pages ?? 0) + chatter
  const message = buddyMessage(state, seed, pokes)
  const drowsy = state.mood === 'sleepy' || state.mood === 'snoozing'
  const face: BuddyMood = awake && drowsy ? 'curious' : state.mood

  const onTap = () => {
    setPokes((n) => n + 1)
    setPoke((n) => n + 1)
    if (drowsy) setAwake(true)
  }

  return (
    <section aria-label={b.label} data-testid="beagle-buddy" data-mood={state.mood} className={cn('animate-rise flex items-center gap-3 surface p-3 pr-4', className)}>
      <button
        type="button"
        onClick={onTap}
        aria-label={`${b.label}: ${b.moods[state.mood]}. ${b.tapHint}`}
        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BuddyArt key={poke} mood={face} cheer={cheer} poked={poke > 0} className="size-24" />
      </button>
      <div className="relative min-w-0 flex-1">
        <span aria-hidden className="absolute top-1/2 -left-2 size-3 -translate-y-1/2 rotate-45 border-b border-l border-border bg-card" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={message}
            role="status"
            className="relative rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium shadow-sm"
            initial={reduce ? false : { opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
          >
            {message}
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  )
}

/** The hound artwork with a face for each mood. Shares its shapes with the logo. */
export function BuddyArt({ mood, cheer, poked, className }: { mood: BuddyMood; cheer?: boolean; poked?: boolean; className?: string }) {
  const openEyes = mood === 'happy' || mood === 'curious'
  return (
    <svg
      viewBox={`0 0 ${HOUND_VIEWBOX} ${HOUND_VIEWBOX}`}
      className={cn('hound buddy', `buddy-${mood}`, openEyes && 'hound-idle', cheer && 'buddy-cheer', poked && 'buddy-poke', className)}
      aria-hidden
      data-testid="buddy-art"
    >
      <g className="buddy-body">
        <g className="hound-head">
          <path d={s.head} fill={c.fur} />
          <path d={s.blaze} fill={c.cream} />
          <ellipse {...s.muzzle} fill={c.cream} />
          <path className="hound-ear hound-ear-left" d={s.earLeft} fill={c.ear} />
          <path className="hound-ear hound-ear-right" d={s.earRight} fill={c.ear} />
          <Eyes mood={mood} />
          <path d={s.nose} fill={c.ink} />
          <Mouth mood={mood} />
        </g>
        <g stroke={c.spine} strokeOpacity={0.25} strokeWidth={6} strokeLinejoin="round">
          <path d={s.pageLeft} fill={c.page} />
          <path d={s.pageRight} fill={c.pageShade} />
        </g>
        <path d={s.spine} stroke={c.spine} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
        <g className="hound-paws">
          {s.paws.map((p) => (
            <ellipse key={p.cx} {...p} {...s.pawSize} fill={c.cream} />
          ))}
          <path d={s.toes} stroke={c.fur} strokeWidth={4} strokeLinecap="round" />
        </g>
      </g>
      {mood === 'snoozing' && (
        <g className="buddy-zzz" fill="currentColor" fontWeight={800} fontFamily="inherit">
          <text x={398} y={124} fontSize={42}>z</text>
          <text x={428} y={88} fontSize={52}>z</text>
          <text x={456} y={56} fontSize={62}>Z</text>
        </g>
      )}
      {mood === 'excited' && (
        <g className="buddy-sparkles" fill="#f59e0b">
          <path d="M96 120l10 24 24 10-24 10-10 24-10-24-24-10 24-10z" />
          <path d="M420 92l8 18 18 8-18 8-8 18-8-18-18-8 18-8z" />
          <path d="M446 220l6 13 13 6-13 6-6 13-6-13-13-6 13-6z" />
        </g>
      )}
    </svg>
  )
}

function Eyes({ mood }: { mood: BuddyMood }) {
  const line = { stroke: c.ink, strokeWidth: 9, strokeLinecap: 'round' as const, fill: 'none' }
  if (mood === 'excited')
    return (
      <g className="hound-eyes">
        {s.eyes.map((e) => (
          <path key={e.cx} d={`M${e.cx - 15} ${e.cy + 6}q15-20 30 0`} {...line} />
        ))}
      </g>
    )
  if (mood === 'snoozing')
    return (
      <g className="hound-eyes">
        {s.eyes.map((e) => (
          <path key={e.cx} d={`M${e.cx - 15} ${e.cy}q15 12 30 0`} {...line} />
        ))}
      </g>
    )
  return (
    <g className="hound-eyes">
      {s.eyes.map((e) => (
        <g key={e.cx}>
          <circle cx={e.cx} cy={e.cy} r={s.eyeRadius} fill={c.ink} />
          <circle cx={e.cx + s.glintOffset.dx} cy={e.cy + s.glintOffset.dy} r={s.glintOffset.r} fill="#fff" />
          {mood === 'sleepy' && (
            <>
              {/* Heavy lids over the top half of each eye. */}
              <path d={`M${e.cx - 17} ${e.cy + 2}a17 17 0 0 1 34 0z`} fill={c.fur} />
              <path d={`M${e.cx - 17} ${e.cy + 2}h34`} stroke={c.ear} strokeWidth={5} strokeLinecap="round" />
            </>
          )}
        </g>
      ))}
    </g>
  )
}

function Mouth({ mood }: { mood: BuddyMood }) {
  if (mood === 'excited')
    return (
      <g>
        <path d="M236 294q20 30 40 0z" fill={c.ink} />
        <path d="M246 302q10 18 20 0z" fill="#f472b6" />
      </g>
    )
  if (mood === 'happy') return <path d="M238 296q18 14 36 0" stroke={c.ink} strokeWidth={6} strokeLinecap="round" fill="none" />
  if (mood === 'curious') return <ellipse cx={256} cy={302} rx={6} ry={7} fill={c.ink} />
  return null
}
