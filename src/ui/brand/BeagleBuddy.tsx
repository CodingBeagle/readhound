import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Search, Shuffle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { today as todayOf } from '@/db/clock'
import { buddyState, hashOf, SETTING_BUDDY_INTRODUCED, type BuddyMood } from '@/domain/buddy'
import {
  bookInLibrary,
  isQuoteTurn,
  parseQuoteHistory,
  pickQuote,
  quoteSearchText,
  quotesFor,
  quoteTheme,
  rememberQuote,
  SETTING_QUOTE_HISTORY,
  type Quote,
  type QuoteData,
  type QuoteTheme,
} from '@/domain/quotes'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/components/ui/button'
import { useAchievements } from '@/ui/achievements/useAchievements'
import { useWeeklyGoal } from '@/ui/hooks/useWeeklyGoal'
import { useQuoteData, useQuoteSettings } from '@/ui/hooks/useQuotes'
import { useStatsModel } from '@/ui/hooks/useStats'
import { celebrateBookAdded } from '@/ui/motion/bookAddedConfetti'
import { useAsleep, useBedtime, useFestive } from '@/ui/season/season'

import { buddyMessage } from './buddyMessages'
import { HOUND_VIEWBOX, houndColors as c, houndShapes as s, SANTA_HAT_ON_HEAD } from './houndArt'
import { Nightcap, PyjamaSleeves } from './Pyjamas'
import { SantaHat } from './SantaHat'

const b = t.buddy

/** Settings key for the milestones the buddy has already cheered, so each one gets confetti once. */
export const SETTING_BUDDY_CELEBRATED = 'buddyCelebrated'
export { SETTING_BUDDY_INTRODUCED }
const KEEP_CELEBRATED = 60
/** How long a tapped sleepy buddy stays awake. */
const AWAKE_MS = 4000
/** The buddy moves on to its next comment this often (with a weekly goal or quotes on). */
export const CHATTER_MS = 20_000
/** A quote stays up a little longer, so there is time to read it. */
export const QUOTE_MS = 30_000

/**
 * Zico, the beagle buddy on Home (design doc, Beagle buddy): its mood follows the
 * reader's reading, it says something in a speech bubble, and it cheers with
 * confetti once per fresh milestone. Tapping it gets a reaction, and wakes it
 * up for a moment when it is sleepy. With quotes on, it takes turns between its
 * own lines and a quote from a classic book; tapping it during a quote shows
 * another one. The very first time, he introduces himself by name until his
 * next comment, a tap, or news about the reading.
 */
export function BeagleBuddy({ className }: { className?: string }) {
  const { db, clock } = useServices()
  const model = useStatsModel()
  const summary = useAchievements()
  const goals = useLiveQuery(() => db.goals.toArray(), [db])
  const celebrated = useLiveQuery(async () => ((await db.settings.get(SETTING_BUDDY_CELEBRATED))?.value as string[] | undefined) ?? [], [db])
  const introduced = useLiveQuery(async () => Boolean((await db.settings.get(SETTING_BUDDY_INTRODUCED))?.value), [db])
  /** Set while this visit is the one where Zico says hello; stays on after the setting is saved. */
  const [introducing, setIntroducing] = useState(false)
  /** Midnight to 06:00 Zico sleeps: no quotes, no cheering (milestones wait for the morning). */
  const asleep = useAsleep()
  useEffect(() => {
    // He says hello when he is awake, not in his sleep.
    if (introduced !== false || asleep) return
    setIntroducing(true)
    void db.settings.put({ key: SETTING_BUDDY_INTRODUCED, value: true })
  }, [introduced, db, asleep])
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
  const quoteSettings = useQuoteSettings()
  const quotesOn = Boolean(quoteSettings?.enabled)
  const quoteData = useQuoteData(quotesOn)
  const favourites = quoteSettings?.themes
  const daySeed = hashOf(today)
  const quotes = useMemo(() => (quoteData && favourites ? quotesFor(quoteData, favourites) : []), [quoteData, favourites])
  const quoteHistory = useLiveQuery(async () => parseQuoteHistory((await db.settings.get(SETTING_QUOTE_HISTORY))?.value), [db])

  const [chatter, setChatter] = useState(0)
  /** Quotes skipped with a tap or the Another button. */
  const [skipped, setSkipped] = useState(0)
  const [pokes, setPokes] = useState(0)
  const hasMilestone = Boolean(state?.milestone)
  const quoting = !asleep && !introducing && quotes.length > 0 && isQuoteTurn(chatter, daySeed, hasMilestone)
  // Each quote turn, and each skip, draws a new random quote, avoiding the ones shown lately (also on earlier visits).
  const [current, setCurrent] = useState<Quote>()
  const pickKey = quoting ? `${chatter}:${skipped}` : undefined
  const pickedFor = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!pickKey || !quoteHistory || pickedFor.current === pickKey) return
    pickedFor.current = pickKey
    const next = pickQuote(quotes, quoteHistory)
    if (!next) return
    setCurrent(next)
    void db.settings.put({ key: SETTING_QUOTE_HISTORY, value: rememberQuote(quoteHistory, next.id) })
  }, [pickKey, quoteHistory, quotes, db])
  const quote = quoting && current && quotes.some((q) => q.id === current.id) ? current : undefined
  const rotates = introducing || (Boolean(state?.weekly) && !hasMilestone) || quotes.length > 0
  useEffect(() => {
    if (!rotates) return
    // A new timer for every turn and every skipped quote, so a fresh quote gets its full time.
    const timer = setTimeout(
      () => {
        if (introducing) return setIntroducing(false)
        setChatter((n) => n + 1)
        setPokes(0)
      },
      quoting ? QUOTE_MS : CHATTER_MS,
    )
    return () => clearTimeout(timer)
  }, [rotates, quoting, chatter, skipped, introducing])
  const [poke, setPoke] = useState(0)
  const [awake, setAwake] = useState(false)
  const [cheer, setCheer] = useState(false)
  const cheered = useRef<string | null>(null)

  const milestoneKey = state?.milestone?.key
  // The greeting gives way as soon as there is news: a milestone, a new mood or pages logged.
  const newsKey = state && `${state.mood}:${milestoneKey ?? ''}:${state.weekly?.band ?? ''}:${state.weekly?.pages ?? ''}`
  const introNews = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!introducing || !newsKey) return
    if (introNews.current === undefined) introNews.current = newsKey
    else if (introNews.current !== newsKey) setIntroducing(false)
  }, [introducing, newsKey])
  useEffect(() => {
    if (asleep || !milestoneKey || !celebrated || cheered.current === milestoneKey || celebrated.includes(milestoneKey)) return
    cheered.current = milestoneKey
    void db.settings.put({ key: SETTING_BUDDY_CELEBRATED, value: [...celebrated, milestoneKey].slice(-KEEP_CELEBRATED) })
    setCheer(true)
    // Achievements already get their own toast with confetti; the buddy just jumps for those.
    if (state?.milestone?.kind !== 'achievement') void celebrateBookAdded()
  }, [asleep, milestoneKey, celebrated, db, state?.milestone?.kind])

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
  const sleepLines = awake ? b.asleep.stirred : b.asleep.lines
  const message = asleep ? sleepLines[(seed + pokes) % sleepLines.length]! : introducing && pokes === 0 ? b.intro[seed % b.intro.length]! : buddyMessage(state, seed, pokes)
  const drowsy = asleep || state.mood === 'sleepy' || state.mood === 'snoozing'
  // Asleep he snoozes on his book; a tap only half wakes him, and he soon nods off again.
  const face: BuddyMood = asleep ? (awake ? 'sleepy' : 'snoozing') : awake && drowsy ? 'curious' : state.mood

  const onTap = () => {
    setPoke((n) => n + 1)
    if (introducing) setIntroducing(false)
    if (quote) return setSkipped((n) => n + 1)
    setPokes((n) => n + 1)
    if (drowsy) setAwake(true)
  }

  return (
    <section aria-label={b.label} data-testid="beagle-buddy" data-mood={state.mood} data-asleep={asleep || undefined} className={cn('animate-rise flex items-center gap-3 surface p-3 pr-4', className)}>
      <button
        type="button"
        onClick={onTap}
        aria-label={`${b.label}: ${asleep ? b.asleep.mood : b.moods[state.mood]}. ${quote ? b.quotes.tapHint : b.tapHint}`}
        className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BuddyArt key={poke} mood={face} cheer={cheer} poked={poke > 0} className="size-24" />
        <span
          aria-hidden
          data-testid="buddy-name-tag"
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rotate-[-4deg] rounded-full bg-primary px-2 py-0.5 text-[0.7rem] leading-none font-extrabold tracking-wide text-primary-foreground shadow-sm"
        >
          {b.nameTag}
        </span>
      </button>
      <div className="relative min-w-0 flex-1">
        <span aria-hidden className="absolute top-1/2 -left-2 size-3 -translate-y-1/2 rotate-45 border-b border-l border-border bg-card" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={quote?.id ?? message}
            className="relative rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium shadow-sm"
            initial={reduce ? false : { opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
          >
            {quote && quoteData ? (
              <QuoteBubble quote={quote} data={quoteData} favourites={favourites ?? []} onAnother={() => setSkipped((n) => n + 1)} />
            ) : (
              <p role="status">{message}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

/** A quote in the speech bubble: the line, the book, and a way to another quote or the book itself. */
function QuoteBubble({ quote, data, favourites, onAnother }: { quote: Quote; data: QuoteData; favourites: readonly QuoteTheme[]; onAnother: () => void }) {
  const model = useStatsModel()
  const book = data.books[quote.book]!
  const owned = model ? bookInLibrary(book, model.books) : undefined
  const q = b.quotes
  return (
    <div data-testid="buddy-quote" data-quote={quote.id}>
      <figure role="status" className="m-0">
        <p className="mb-1 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{q.label(t.quoteThemes[quoteTheme(quote, favourites)])}</p>
        <blockquote className="font-display text-[0.95rem] leading-snug font-normal italic">{quote.text}</blockquote>
        <figcaption className="mt-1.5 text-xs font-medium text-muted-foreground">
          — {q.by(book.author, book.title)}
          {book.translator && <span className="block font-normal">{q.translated(book.translator)}</span>}
        </figcaption>
      </figure>
      <div className="mt-1.5 -mb-1 -ml-2 flex flex-wrap">
        <Button type="button" variant="ghost" size="sm" className="h-9 px-2" aria-label={q.another} onClick={onAnother}>
          <Shuffle aria-hidden />
          {q.anotherShort}
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9 px-2">
          {owned ? (
            <Link to={`/book/${owned.entry.id}`}>
              <BookOpen aria-hidden />
              {q.inLibrary}
            </Link>
          ) : (
            <Link to={`/search?q=${encodeURIComponent(quoteSearchText(book))}`} aria-label={q.find}>
              <Search aria-hidden />
              {q.findShort}
            </Link>
          )}
        </Button>
      </div>
    </div>
  )
}

/** The hound artwork with a face for each mood. Shares its shapes with the logo. */
export function BuddyArt({ mood, cheer, poked, className }: { mood: BuddyMood; cheer?: boolean; poked?: boolean; className?: string }) {
  const openEyes = mood === 'happy' || mood === 'curious'
  const festive = useFestive()
  const bedtime = useBedtime()
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
          {festive ? <SantaHat transform={SANTA_HAT_ON_HEAD} /> : bedtime && <Nightcap transform={SANTA_HAT_ON_HEAD} />}
        </g>
        <g stroke={c.spine} strokeOpacity={0.25} strokeWidth={6} strokeLinejoin="round">
          <path d={s.pageLeft} fill={c.page} />
          <path d={s.pageRight} fill={c.pageShade} />
        </g>
        <path d={s.spine} stroke={c.spine} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
        {bedtime && <PyjamaSleeves festive={festive} />}
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
