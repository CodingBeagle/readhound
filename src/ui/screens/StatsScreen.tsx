import { BookOpen, Flame, Gauge, Layers, Timer } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useServices } from '@/app/services'
import { today as todayOf } from '@/db/clock'
import {
  authorCountries,
  booksRead,
  currentStreak,
  dataRange,
  fictionSplit,
  finishForecast,
  genresOverTime,
  goalPace,
  heatmap,
  languages,
  lengthDistribution,
  longestStreak,
  milestones,
  newVsReturningAuthors,
  originalsVsTranslations,
  pagesByWeekdayAndHour,
  pagesPerDay,
  pagesRead,
  perMonth,
  periodFor,
  publicationDecades,
  ratingsByGenre,
  ratingsVsLength,
  readingSpeedInPeriod,
  rereads,
  stackHeight,
  startedVsFinished,
  timeToFinish,
  toReadPile,
  topAuthors,
  waitBeforeStarting,
  whereIStop,
  yearOf,
  type Period,
  type PeriodPreset,
  type StatsModel,
} from '@/domain/stats'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select } from '@/ui/components/ui/input'
import { useStatsModel } from '@/ui/hooks/useStats'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'
import { AuthorMap } from '@/ui/stats/AuthorMap'
import { ChartCard, StatTile } from '@/ui/stats/ChartCard'
import { DonutChart, formatNumber, OTHER, RatingScatter, SERIES, SimpleBarChart, SplitBar, StackedBarChart } from '@/ui/stats/charts'
import { GoalPaceBar } from '@/ui/stats/GoalPaceBar'
import { Heatmap } from '@/ui/stats/Heatmap'

const s = t.screens.stats

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const languageName = (code: string) => {
  if (code === 'unknown') return s.unknown
  try {
    return languageNames.of(code) ?? code
  } catch {
    return code
  }
}
const countryName = (code: string) => {
  if (code === 'unknown') return s.noCountry
  try {
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}
const monthLabel = (month: string, style: 'short' | 'long' = 'short') =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en', { month: style, ...(style === 'long' && { year: 'numeric' }) })
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })

/** All stats from the design doc's definitions table, filtered by period. */
export function StatsScreen() {
  const model = useStatsModel()
  const { clock } = useServices()
  const today = todayOf(clock)
  const [params, setParams] = useSearchParams()
  const preset = (params.get('period') ?? 'this_year') as PeriodPreset
  const custom: Period = { from: params.get('from') || undefined, to: params.get('to') || undefined }
  const includeDnf = params.get('dnf') === '1'
  const period = periodFor(preset, today, custom)

  const set = (changes: Record<string, string>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(changes)) {
          if (v) p.set(k, v)
          else p.delete(k)
        }
        return p
      },
      { replace: true },
    )

  if (!model) return <ScreenHeader title={s.title} />
  const hasData = model.reads.length > 0
  if (!hasData)
    return (
      <>
        <ScreenHeader title={s.title} />
        <EmptyState>
          <p className="mb-3">{s.empty}</p>
          <p className="mb-3">{s.tryDemo}</p>
          <Button asChild variant="outline">
            <Link to="/demo">{t.demo.title}</Link>
          </Button>
        </EmptyState>
      </>
    )

  const first = dataRange(model).first ?? today
  const years = Array.from({ length: yearOf(today) - yearOf(first) + 1 }, (_, i) => yearOf(today) - i).filter((y) => y < yearOf(today) - 1)

  return (
    <>
      <ScreenHeader title={s.title} />
      <div className="mb-5 flex flex-col gap-2">
        <div className="flex gap-2">
          <Select aria-label={s.period} value={preset} onChange={(e) => set({ period: e.target.value === 'this_year' ? '' : e.target.value })} className="min-w-0 flex-1">
            <option value="this_year">{s.periods.this_year}</option>
            <option value="last_year">{s.periods.last_year}</option>
            {years.map((y) => (
              <option key={y} value={`year:${y}`}>
                {y}
              </option>
            ))}
            <option value="last_12_months">{s.periods.last_12_months}</option>
            <option value="all">{s.periods.all}</option>
            <option value="custom">{s.periods.custom}</option>
          </Select>
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label={s.from}>
              <Input type="date" value={custom.from ?? ''} max={custom.to} onChange={(e) => set({ from: e.target.value })} />
            </Field>
            <Field label={s.to}>
              <Input type="date" value={custom.to ?? ''} min={custom.from} onChange={(e) => set({ to: e.target.value })} />
            </Field>
          </div>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--chart-1)]" checked={includeDnf} onChange={(e) => set({ dnf: e.target.checked ? '1' : '' })} />
          <span>
            {s.includeDnf}
            <span className="block text-xs text-muted-foreground">{s.includeDnfHint}</span>
          </span>
        </label>
      </div>

      <Overview model={model} period={period} preset={preset} today={today} />
      <Habits model={model} period={period} today={today} />
      <WhatIRead model={model} period={period} includeDnf={includeDnf} />
      <MyLibrary model={model} period={period} today={today} />
      <FunExtras model={model} period={period} includeDnf={includeDnf} />
    </>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  )
}

// ---------- Overview ----------

function Overview({ model, period, preset, today }: { model: StatsModel; period: Period; preset: PeriodPreset; today: string }) {
  const { db } = useServices()
  const books = booksRead(model, period)
  const pages = pagesRead(model, period)
  const perDay = pagesPerDay(model, period, today)
  const months = perMonth(model, period, today)
  const multiYear = months.length > 0 && months[0]!.month.slice(0, 4) !== months.at(-1)!.month.slice(0, 4)
  const tick = (m: string) => (multiYear ? `${monthLabel(m)} ’${m.slice(2, 4)}` : monthLabel(m))
  const goalYear = preset === 'this_year' ? yearOf(today) : preset === 'last_year' ? yearOf(today) - 1 : preset.startsWith('year:') ? Number(preset.slice(5)) : undefined
  const goal = useLiveQuery(async () => (goalYear ? ((await db.goals.get(goalYear)) ?? null) : null), [db, goalYear])

  return (
    <Group title={t.screens.stats.sections.overview}>
      <div className="grid grid-cols-2 gap-3 md:col-span-2">
        <StatTile label={s.booksRead} value={formatNumber(books.total)} detail={books.unique !== books.total ? s.uniqueBooks(books.unique) : undefined} />
        <StatTile label={s.pagesRead} value={formatNumber(pages)} />
        <StatTile label={s.perDay} value={formatNumber(perDay.perDay, 1)} detail={s.perReadingDay(formatNumber(perDay.perReadingDay, 0))} />
        <StreakTile model={model} today={today} />
      </div>
      {goalYear !== undefined && goal && (
        <ChartCard title={s.goal(goalYear)} className="md:col-span-2">
          {goal.targetBooks !== undefined && <GoalPaceBar pace={goalPace(goal.targetBooks, books.total, goalYear, today)} unit="books" />}
          {goal.targetPages !== undefined && <GoalPaceBar pace={goalPace(goal.targetPages, pages, goalYear, today)} unit="pages" />}
        </ChartCard>
      )}
      {goalYear === yearOf(today) && goal === null && (
        <p className="text-sm text-muted-foreground md:col-span-2">
          <Link to="/profile" className="underline underline-offset-4">
            {s.setGoal}
          </Link>
        </p>
      )}
      <ChartCard
        title={s.booksPerMonth}
        table={{ headers: [s.month, s.books], rows: months.map((m) => [monthLabel(m.month, 'long'), m.books]) }}
      >
        <SimpleBarChart data={months} x="month" y="books" name={s.books} tickFormatter={tick} labelFormatter={(m) => monthLabel(m, 'long')} />
      </ChartCard>
      <ChartCard
        title={s.pagesPerMonth}
        table={{ headers: [s.month, s.pages], rows: months.map((m) => [monthLabel(m.month, 'long'), formatNumber(m.pages)]) }}
      >
        <SimpleBarChart data={months} x="month" y="pages" name={s.pages} tickFormatter={tick} labelFormatter={(m) => monthLabel(m, 'long')} />
      </ChartCard>
    </Group>
  )
}

function StreakTile({ model, today }: { model: StatsModel; today: string }) {
  const current = currentStreak(model, today)
  const longest = longestStreak(model)
  return (
    <StatTile
      label={s.currentStreak}
      value={
        <span className="flex items-center gap-1">
          <Flame aria-hidden className="size-5 text-[var(--chart-2)]" />
          {s.days(current.length)}
        </span>
      }
      detail={`${s.longestStreak}: ${s.days(longest.length)}`}
    />
  )
}

// ---------- Reading habits ----------

function Habits({ model, period, today }: { model: StatsModel; period: Period; today: string }) {
  const heat = useMemo(() => heatmap(model, today), [model, today])
  const { weekday, hour } = pagesByWeekdayAndHour(model, period)
  const speed = readingSpeedInPeriod(model, period)
  const finishes = timeToFinish(model, period)
  const open = model.reads.filter((r) => r.outcome === undefined && r.book.entry.status === 'reading')
  const longest = longestStreak(model)
  const weekdayData = weekday.map((pages, i) => ({ day: s.weekdaysShort[i]!, pages }))
  const hourData = hour.map((pages, h) => ({ hour: String(h).padStart(2, '0'), pages }))

  return (
    <Group title={s.sections.habits}>
      <ChartCard
        title={s.heatmap}
        summary={longest.length ? `${s.longestStreak}: ${s.days(longest.length)} (${dateLabel(longest.from!)} – ${dateLabel(longest.to!)})` : undefined}
        className="md:col-span-2"
        table={{ headers: [s.date, s.pages], rows: heat.filter((d) => d.pages > 0).map((d) => [d.date, d.pages]) }}
      >
        <Heatmap days={heat} />
      </ChartCard>
      <ChartCard title={s.weekdayChart} table={{ headers: ['', s.pages], rows: weekday.map((p, i) => [s.weekdays[i]!, formatNumber(p)]) }}>
        <SimpleBarChart data={weekdayData} x="day" y="pages" name={s.pages} />
      </ChartCard>
      <ChartCard title={s.hourChart} table={{ headers: [s.hour, s.pages], rows: hourData.filter((h) => h.pages).map((h) => [`${h.hour}:00`, formatNumber(h.pages)]) }}>
        <SimpleBarChart data={hourData} x="hour" y="pages" name={s.pages} labelFormatter={(h) => `${h}:00`} />
      </ChartCard>
      <ChartCard title={s.speed}>
        {speed.overall === undefined ? (
          <p className="text-sm text-muted-foreground">{s.noSpeed}</p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-2xl font-semibold">
              <Gauge aria-hidden className="size-5 text-muted-foreground" />
              {s.pagesPerHour(formatNumber(speed.overall))}
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {speed.perBook.slice(0, 5).map(({ read, pagesPerHour }) => (
                <li key={read.id} className="flex justify-between gap-2">
                  <span className="truncate">{read.book.title}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{formatNumber(pagesPerHour)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ChartCard>
      <ChartCard title={s.forecast}>
        <ul className="flex flex-col gap-2 text-sm">
          {open.map((read) => {
            const forecast = finishForecast(read, today)
            return (
              <li key={read.id} className="flex items-start gap-2">
                <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <Link to={`/book/${read.book.entry.id}`} className="font-medium underline-offset-4 hover:underline">
                    {read.book.title}
                  </Link>
                  <span className="block text-muted-foreground">{forecast ? s.finishAround(dateLabel(forecast.date)) : s.noForecast}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </ChartCard>
      {finishes.length > 0 && (
        <ChartCard title={s.timeToFinish} table={{ headers: [t.screens.manual.bookTitle, s.daysLabel], rows: finishes.map((f) => [f.read.book.title, f.days]) }}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <FinishList title={s.fastest} items={finishes.slice(0, 3)} />
            <FinishList title={s.slowest} items={finishes.slice(-3).reverse()} />
          </div>
        </ChartCard>
      )}
    </Group>
  )
}

function FinishList({ title, items }: { title: string; items: ReturnType<typeof timeToFinish> }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Timer aria-hidden className="size-3.5" />
        {title}
      </p>
      <ol className="flex flex-col gap-1">
        {items.map(({ read, days }) => (
          <li key={read.id} className="min-w-0">
            <span className="block truncate">{read.book.title}</span>
            <span className="text-xs text-muted-foreground">{s.days(days)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------- What I read ----------

function WhatIRead({ model, period, includeDnf }: { model: StatsModel; period: Period; includeDnf: boolean }) {
  const byYear = !period.from || !period.to || yearOf(period.from) !== yearOf(period.to)
  const genreRows = genresOverTime(model, period, byYear ? 'year' : 'month', includeDnf)
  // Colour follows the genre, not its rank: genres keep their slot (alphabetical) whatever the period.
  const genres = model.categories.filter((c) => c.kind === 'genre').sort((a, b) => a.name.localeCompare(b.name, 'da'))
  const shown = genres.slice(0, 7)
  const series = [
    ...shown.map((g, i) => ({ key: g.id, name: g.name, color: SERIES[i]! })),
    { key: 'other', name: genres.length > 7 ? s.other : s.noGenre, color: OTHER },
  ]
  const genreData = genreRows.map((row) => {
    const out: Record<string, string | number> = { bucket: row.bucket }
    for (const [id, n] of Object.entries(row.genres)) {
      const key = shown.some((g) => g.id === id) ? id : 'other'
      out[key] = Number(out[key] ?? 0) + n
    }
    return out
  })
  const usedSeries = series.filter((sr) => genreData.some((row) => row[sr.key]))

  const authors = topAuthors(model, period, includeDnf)
  const authorSplit = newVsReturningAuthors(model, period, includeDnf)
  const langs = languages(model, period, includeDnf)
  const langData = [
    ...langs.slice(0, 3).map((l, i) => ({ name: languageName(l.key), value: l.count, color: SERIES[i]! })),
    ...(langs.length > 3 ? [{ name: s.other, value: langs.slice(3).reduce((sum, l) => sum + l.count, 0), color: OTHER }] : []),
  ]
  const translations = originalsVsTranslations(model, period, includeDnf)
  const fiction = fictionSplit(model, period, includeDnf)
  const decades = publicationDecades(model, period, includeDnf).map((d) => ({ decade: d.key === 'unknown' ? s.unknown : `${d.key}s`, count: d.count }))
  const lengths = lengthDistribution(model, period, includeDnf)

  if (authors.length === 0)
    return (
      <Group title={s.sections.what}>
        <p className="text-sm text-muted-foreground">{s.noData}</p>
      </Group>
    )

  return (
    <Group title={s.sections.what}>
      <ChartCard
        title={s.genres}
        className="md:col-span-2"
        table={{ headers: ['', ...usedSeries.map((sr) => sr.name)], rows: genreData.map((row) => [labelBucket(String(row.bucket)), ...usedSeries.map((sr) => formatNumber(Number(row[sr.key] ?? 0), 1))]) }}
      >
        {genres.length === 0 ? <p className="text-sm text-muted-foreground">{s.noGenres}</p> : <StackedBarChart data={genreData} x="bucket" series={usedSeries} tickFormatter={labelBucket} />}
      </ChartCard>
      <ChartCard title={s.topAuthors} summary={`${s.newAuthors(authorSplit.new)} · ${s.returningAuthors(authorSplit.returning)}`}>
        <ol className="flex flex-col gap-1 text-sm">
          {authors.slice(0, 8).map((a, i) => (
            <li key={a.authorId} className="flex justify-between gap-2">
              <span className="truncate">
                <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
                {a.name}
              </span>
              <span className="text-muted-foreground tabular-nums">{a.count}</span>
            </li>
          ))}
        </ol>
      </ChartCard>
      <ChartCard title={s.languages} table={{ headers: [s.language, s.books], rows: langs.map((l) => [languageName(l.key), l.count]) }}>
        <DonutChart data={langData} />
      </ChartCard>
      <ChartCard title={s.translations}>
        <SplitBar
          parts={[
            { name: s.original, value: translations.original, color: SERIES[0]! },
            { name: s.translated, value: translations.translated, color: SERIES[1]! },
            { name: s.unknown, value: translations.unknown, color: OTHER },
          ]}
        />
      </ChartCard>
      <ChartCard title={s.fiction}>
        <SplitBar
          parts={[
            { name: s.fictionLabel, value: fiction.fiction, color: SERIES[0]! },
            { name: s.nonfiction, value: fiction.nonfiction, color: SERIES[1]! },
            { name: s.unknown, value: fiction.unknown, color: OTHER },
          ]}
        />
      </ChartCard>
      <ChartCard title={s.decades} table={{ headers: [s.decade, s.books], rows: decades.map((d) => [d.decade, d.count]) }}>
        <SimpleBarChart data={decades} x="decade" y="count" name={s.books} />
      </ChartCard>
      <ChartCard title={s.length} table={{ headers: [s.lengthUnit, s.books], rows: lengths.buckets.map((b) => [b.bucket, b.count]) }}>
        <SimpleBarChart data={lengths.buckets} x="bucket" y="count" name={s.books} />
      </ChartCard>
    </Group>
  )
}

const labelBucket = (bucket: string) => (bucket.length === 7 ? monthLabel(bucket) : bucket)

// ---------- My library ----------

function MyLibrary({ model, period, today }: { model: StatsModel; period: Period; today: string }) {
  const pile = toReadPile(model, today)
  const wait = waitBeforeStarting(model, period)
  const flow = startedVsFinished(model, period)
  const stops = whereIStop(model, period)
  const stopData = stops.buckets.map((b) => ({ share: `${b.from}%`, count: b.count }))
  const again = rereads(model, period)

  return (
    <Group title={s.sections.library}>
      <ChartCard title={s.startedFinished}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [s.started, flow.started],
            [s.finished, flow.finished],
            [s.dnf, flow.dnf],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted p-2">
              <div className="text-xl font-semibold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </ChartCard>
      <ChartCard title={s.toRead} summary={`${s.pileBooks(pile.count)} · ${s.averageWait(Math.round(pile.averageWait))} · ${s.longestWait(pile.longestWait)}`}>
        <ol className="flex flex-col gap-1 text-sm">
          {pile.oldest.map(({ book, waitingDays }) => (
            <li key={book.entry.id} className="flex justify-between gap-2">
              <Link to={`/book/${book.entry.id}`} className="truncate underline-offset-4 hover:underline">
                {book.title}
              </Link>
              <span className="shrink-0 text-muted-foreground tabular-nums">{s.days(waitingDays)}</span>
            </li>
          ))}
        </ol>
      </ChartCard>
      <ChartCard
        title={s.waitBeforeStarting}
        summary={wait.average !== undefined ? s.averageWaitBefore(Math.round(wait.average)) : undefined}
        table={{ headers: [s.wait, s.books], rows: wait.buckets.map((b) => [b.label, b.count]) }}
      >
        <SimpleBarChart data={wait.buckets} x="label" y="count" name={s.books} />
      </ChartCard>
      <ChartCard title={s.whereIStop} table={{ headers: [s.stopShare, s.books], rows: stopData.map((d) => [d.share, d.count]) }}>
        <SimpleBarChart data={stopData} x="share" y="count" name={s.books} />
      </ChartCard>
      <ChartCard title={s.rereads}>
        {again.length === 0 ? (
          <p className="text-sm text-muted-foreground">{s.noRereads}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {again.map((r) => (
              <li key={r.title} className="flex justify-between gap-2">
                <span className="truncate">{r.title}</span>
                <span className="text-muted-foreground">{s.times(r.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </Group>
  )
}

// ---------- Fun extras ----------

function FunExtras({ model, period, includeDnf }: { model: StatsModel; period: Period; includeDnf: boolean }) {
  const pages = pagesRead(model, period)
  const stack = stackHeight(pages)
  const countries = authorCountries(model, period, includeDnf)
  const scatter = ratingsVsLength(model, period, includeDnf)
  const genreName = new Map(model.categories.map((c) => [c.id, c.name]))
  const byGenre = ratingsByGenre(model, period, includeDnf).map((g) => ({ genre: genreName.get(g.genreId) ?? '', average: Math.round(g.average * 10) / 10 }))
  const badges = milestones(model)

  return (
    <Group title={s.sections.fun}>
      <ChartCard title={s.stack}>
        <p className="flex items-start gap-2 text-sm">
          <Layers aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {s.stackLine(
            stack.metres < 1 ? `${formatNumber(stack.metres * 100)} cm` : `${formatNumber(stack.metres, 1)} m`,
            formatNumber(stack.times, stack.times < 10 ? 1 : 0),
            stack.landmark.name,
          )}
        </p>
      </ChartCard>
      <ChartCard title={s.authorMap} className="md:col-span-2" table={{ headers: [s.country, s.books], rows: countries.map((c) => [countryName(c.key), c.count]) }}>
        <AuthorMap counts={new Map(countries.filter((c) => c.key !== 'unknown').map((c) => [c.key, c.count]))} label={s.authorMap} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {countries.slice(0, 6).map((c) => (
            <li key={c.key}>
              <span className="text-foreground">{countryName(c.key)}</span> {c.count}
            </li>
          ))}
        </ul>
      </ChartCard>
      {scatter.length > 0 && (
        <ChartCard title={s.ratingsVsLength} table={{ headers: [t.screens.manual.bookTitle, s.pages, s.rating], rows: scatter.map((p) => [p.title, p.pages, p.rating]) }}>
          <RatingScatter data={scatter} xName={s.pages} yName={s.rating} />
        </ChartCard>
      )}
      {byGenre.length > 0 && (
        <ChartCard title={s.ratingsByGenre} table={{ headers: ['', s.averageRating], rows: byGenre.map((g) => [g.genre, g.average]) }}>
          <SimpleBarChart data={byGenre} x="genre" y="average" name={s.averageRating} yDomain={[0, 5]} />
        </ChartCard>
      )}
      <ChartCard title={s.milestones} className="md:col-span-2">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {badges.map((m) => (
            <li key={m.id} className={m.unlockedOn ? 'rounded-lg border border-[var(--chart-1)] p-2' : 'rounded-lg border border-dashed p-2 opacity-70'}>
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.unlockedOn ? s.unlocked(dateLabel(m.unlockedOn)) : s.locked(Math.floor(m.progress * 100))}</p>
            </li>
          ))}
        </ul>
      </ChartCard>
    </Group>
  )
}
