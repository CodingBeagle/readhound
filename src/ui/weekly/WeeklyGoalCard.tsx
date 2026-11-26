import { Pencil, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { today as todayOf } from '@/db/clock'
import type { BookView } from '@/domain/bookView'
import { pageAfterReading, WEEKLY_GOAL_MAX, WEEKLY_GOAL_PRESETS, weeklyProgress, type WeeklyProgress } from '@/domain/weeklyGoal'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/components/ui/button'
import { Input, Select } from '@/ui/components/ui/input'
import { useSetWeeklyGoal, useWeeklyGoal } from '@/ui/hooks/useWeeklyGoal'
import { useStatsModel } from '@/ui/hooks/useStats'
import { CountUp } from '@/ui/motion/CountUp'
import { formatNumber } from '@/ui/stats/format'

import { WeeklyGoalBar } from './WeeklyGoalBar'

const w = t.screens.weekly
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/**
 * Home card for the weekly pages goal (design doc, Weekly pages goal): set a
 * goal in one tap, see the week fill up, and log today's pages on the book
 * you are reading.
 */
export function WeeklyGoalCard({ reading, className }: { reading: readonly BookView[]; className?: string }) {
  const target = useWeeklyGoal()
  const model = useStatsModel()
  const { clock } = useServices()
  const today = todayOf(clock)
  const [editing, setEditing] = useState(false)
  const week = useMemo(() => (model && target ? weeklyProgress(model, target, today) : undefined), [model, target, today])

  if (target === undefined || !model) return null
  if (target === null || editing)
    return (
      <section aria-label={w.label} data-testid="weekly-goal" className={cn('animate-rise surface p-4', className)}>
        <GoalPicker current={target ?? undefined} onDone={() => setEditing(false)} />
      </section>
    )
  if (!week) return null

  return (
    <section aria-label={w.label} data-testid="weekly-goal" data-band={week.band} className={cn('animate-rise flex flex-col gap-3 surface p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Target aria-hidden className="size-4" />
            {w.title}
          </h2>
          <p className="title text-2xl tabular-nums" data-testid="weekly-pages">
            <CountUp value={formatNumber(week.pages)} />
            <span className="text-base font-medium text-muted-foreground"> / {formatNumber(week.target)} pages</span>
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label={w.edit} onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
      </div>
      <WeeklyGoalBar week={week} />
      <div className="flex items-center justify-between gap-2 text-sm">
        <StatusLine week={week} />
        <DayStrip week={week} today={today} />
      </div>
      <QuickLog reading={reading} />
    </section>
  )
}

function StatusLine({ week }: { week: WeeklyProgress }) {
  if (week.share >= 1)
    return (
      <span key="reached" className="animate-pop font-semibold text-[var(--goal-fill)]">
        {week.pages > week.target ? `${w.reached} ${w.beyond(formatNumber(week.pages - week.target))}` : w.reached}
      </span>
    )
  return (
    <span className="text-muted-foreground">
      {w.toGo(formatNumber(week.remaining), week.daysLeft)}
      {week.daysLeft > 1 && week.pages > 0 && <span className="hidden sm:inline">, {w.perDay(formatNumber(week.perDayNeeded))}</span>}
    </span>
  )
}

/** Monday to Sunday, a dot per day that fills on days with reading. */
function DayStrip({ week, today }: { week: WeeklyProgress; today: string }) {
  return (
    <ol className="flex shrink-0 gap-1" aria-label={w.title}>
      {week.days.map((d, i) => (
        <li
          key={d.date}
          title={w.dayLabel(DAY_NAMES[i]!, d.pages)}
          aria-label={w.dayLabel(DAY_NAMES[i]!, d.pages)}
          className={cn(
            'grid size-6 place-items-center rounded-full text-[10px] font-semibold',
            d.pages > 0 ? 'fill-bar text-white' : 'bg-muted text-muted-foreground',
            d.date === today && 'ring-2 ring-ring/60 ring-offset-1 ring-offset-card',
            d.date > today && 'opacity-50',
          )}
        >
          {DAY_LETTERS[i]}
        </li>
      ))}
    </ol>
  )
}

/** Choose or change the weekly target: one-tap presets or any number. */
function GoalPicker({ current, onDone }: { current?: number; onDone: () => void }) {
  const setGoal = useSetWeeklyGoal()
  const [value, setValue] = useState(current?.toString() ?? '')
  const [error, setError] = useState<string>()

  const save = async (n: number | undefined) => {
    await setGoal(n)
    onDone()
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(value)
    if (!value.trim() || !(n > 0)) return setError(w.invalidGoal)
    void save(n)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Target aria-hidden className="size-4 text-[var(--goal-fill)]" />
          {w.setTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{w.setIntro}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {WEEKLY_GOAL_PRESETS.map((n) => (
          <Button key={n} variant={current === n ? 'default' : 'outline'} onClick={() => void save(n)} aria-label={`${n} pages a week`}>
            {w.preset(n)}
          </Button>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {w.custom}
          <Input
            inputMode="numeric"
            value={value}
            max={WEEKLY_GOAL_MAX}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setError(undefined)
              setValue(e.target.value.replace(/\D/g, ''))
            }}
          />
        </label>
        <Button type="submit">{w.set}</Button>
        {current !== undefined && (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t.common.cancel}
          </Button>
        )}
      </form>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {current !== undefined && (
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => void save(undefined)}>
          {w.remove}
        </Button>
      )}
    </div>
  )
}

const lastLogged = (b: BookView) => b.openSessions.reduce((max, s) => (s.startedAt > max ? s.startedAt : max), b.openRead?.startedOn ?? '')

/**
 * "Pages read today": adds a reading session on a book being read, starting
 * from its current page. Every page belongs to a book so per-book stats and
 * the weekly total always agree; with nothing on the go it points to the library.
 */
function QuickLog({ reading }: { reading: readonly BookView[] }) {
  const { library } = useServices()
  const books = useMemo(() => [...reading].sort((a, b) => lastLogged(b).localeCompare(lastLogged(a))), [reading])
  const [chosen, setChosen] = useState<string>()
  const [value, setValue] = useState('')
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const book = books.find((b) => b.entry.id === chosen) ?? books[0]

  if (!book)
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-2.5 text-sm">
        <span className="text-muted-foreground">{w.noBook}</span>
        <Button asChild size="sm" variant="outline">
          <Link to="/library">{w.startBook}</Link>
        </Button>
      </div>
    )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!book) return
    const pages = Number(value)
    if (!Number.isInteger(pages) || pages <= 0) return setError(w.invalid)
    const to = pageAfterReading(book.currentPage, pages, book.edition.pageCount)
    if (to <= book.currentPage) return setError(w.atEnd(book.edition.title))
    const result = await library.logPage(book.entry.id, to)
    if (!result.ok) return setError(result.error.message)
    setError(undefined)
    setValue('')
    const n = result.session.pagesRead
    setMessage(result.reachedEnd ? w.loggedEnd(n, book.edition.title) : w.logged(n, book.edition.title))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-end gap-2">
        <label className="flex w-28 shrink-0 flex-col gap-1 text-sm font-medium">
          {w.logLabel}
          <Input
            inputMode="numeric"
            placeholder="25"
            value={value}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setError(undefined)
              setValue(e.target.value.replace(/\D/g, ''))
            }}
          />
        </label>
        {books.length > 1 ? (
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
            {w.logBook}
            <Select value={book.entry.id} onChange={(e) => setChosen(e.target.value)}>
              {books.map((b) => (
                <option key={b.entry.id} value={b.entry.id}>
                  {b.edition.title}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <p className="min-w-0 flex-1 truncate pb-3 text-sm text-muted-foreground">{book.edition.title}</p>
        )}
        <Button type="submit" disabled={!value.trim()}>
          {w.logSubmit}
        </Button>
      </div>
      {(error || message) && (
        <p role={error ? 'alert' : 'status'} className={error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {error ?? message}
        </p>
      )}
    </form>
  )
}
