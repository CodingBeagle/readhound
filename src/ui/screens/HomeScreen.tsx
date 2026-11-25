import { useLiveQuery } from 'dexie-react-hooks'
import { Flame } from 'lucide-react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { today as todayOf } from '@/db/clock'
import { progress } from '@/domain/bookView'
import { booksRead, currentStreak, finishForecast, goalPace, pagesRead, periodFor, reviewYears } from '@/domain/stats'
import { t } from '@/i18n'
import { BookCover } from '@/ui/books/BookCover'
import { LogPageForm } from '@/ui/books/LogPageForm'
import { ProgressBar } from '@/ui/books/ProgressBar'
import { Button } from '@/ui/components/ui/button'
import { useLibrary } from '@/ui/hooks/useLibrary'
import { useStatsModel } from '@/ui/hooks/useStats'
import { BackupReminder } from '@/ui/layout/BackupReminder'
import { EmptyState } from '@/ui/layout/EmptyState'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'
import { GoalPaceBar } from '@/ui/stats/GoalPaceBar'
import { LevelCard } from '@/ui/achievements/LevelCard'
import { useAchievements } from '@/ui/achievements/useAchievements'

export function HomeScreen() {
  const books = useLibrary()
  const reading = books?.filter((b) => b.entry.status === 'reading')
  const model = useStatsModel()
  const { db, clock } = useServices()
  const today = todayOf(clock)
  const year = Number(today.slice(0, 4))
  const goal = useLiveQuery(() => db.goals.get(year), [db, year])
  const achievements = useAchievements()
  const streak = model ? currentStreak(model, today) : undefined
  const forecastFor = (entryId: string) => {
    const read = model?.reads.find((r) => r.entryId === entryId && r.outcome === undefined)
    return read && finishForecast(read, today)
  }

  return (
    <>
      <BackupReminder />
      {model && (streak?.length || goal) ? (
        <div className="animate-rise mb-5 flex flex-col gap-3 surface p-4">
          {streak !== undefined && streak.length > 0 && (
            <p className="flex items-center gap-2 text-sm font-medium">
              <Flame aria-hidden className="animate-flicker size-5 text-orange-500" />
              {t.screens.home.streak(streak.length)}
            </p>
          )}
          {goal?.targetBooks !== undefined && <GoalPaceBar pace={goalPace(goal.targetBooks, booksRead(model, periodFor('this_year', today)).total, year, today)} unit="books" />}
          {goal?.targetPages !== undefined && <GoalPaceBar pace={goalPace(goal.targetPages, pagesRead(model, periodFor('this_year', today)), year, today)} unit="pages" />}
        </div>
      ) : null}
      {model && today.slice(5, 7) === '12' && reviewYears(model).includes(year) && (
        <Link
          to={`/stats/year/${year}`}
          className="animate-rise mb-5 flex items-center justify-between gap-3 rounded-[var(--radius)] bg-[#1c1917] p-4 text-sm font-medium text-[#fafaf9]"
        >
          <span>{t.review.homeBanner(year)}</span>
          <span className="text-[#f59e0b]">{t.review.homeBannerAction} →</span>
        </Link>
      )}
      <ScreenHeader title={t.screens.home.title} />
      {reading && reading.length === 0 && (
        <EmptyState>
          <p className="mb-3">{t.screens.home.empty}</p>
          <Button asChild variant="outline">
            <Link to="/search">{t.screens.home.findBook}</Link>
          </Button>
        </EmptyState>
      )}
      <ul className="stagger tint-cycle flex flex-col gap-4">
        {reading?.map((book) => {
          const p = progress(book)
          return (
            <li key={book.entry.id} className="surface p-4">
              <Link to={`/book/${book.entry.id}`} className="mb-3 flex gap-3">
                <BookCover url={book.edition.coverUrl} title={book.edition.title} className="w-16" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">{book.edition.title}</span>
                  <span className="text-sm text-muted-foreground">{book.authorNames.join(', ')}</span>
                  <span className="text-sm">{t.common.pageOf(book.currentPage, book.edition.pageCount)}</span>
                </div>
              </Link>
              {p !== undefined && (
                <div className="mb-3 flex flex-col gap-1">
                  <ProgressBar value={p} label={t.common.pageOf(book.currentPage, book.edition.pageCount)} />
                  <ForecastLine forecast={forecastFor(book.entry.id)} />
                </div>
              )}
              <LogPageForm book={book} />
            </li>
          )
        })}
      </ul>
      {achievements && <LevelCard summary={achievements} className="animate-rise mt-6" />}
    </>
  )
}

function ForecastLine({ forecast }: { forecast?: { date: string } }) {
  if (!forecast) return null
  const label = new Date(`${forecast.date}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short' })
  return <span className="text-xs text-muted-foreground">{t.screens.stats.finishAround(label)}</span>
}
