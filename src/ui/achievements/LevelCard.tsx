import { ChevronRight, Dog } from 'lucide-react'
import { Link } from 'react-router'

import { LEVELS, type AchievementSummary } from '@/domain/achievements'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { CountUp } from '@/ui/motion/CountUp'

import { Medal } from './Medal'

const a = t.achievements

/** Reader level, points and progress to the next level, with the latest medals. Links to the full list unless `link` is false. */
export function LevelCard({ summary, link = true, className }: { summary: AchievementSummary; link?: boolean; className?: string }) {
  const { level, points, unlocks, total } = summary
  const share = level.to === undefined ? 1 : (points - level.from) / (level.to - level.from)
  const recent = [...unlocks].sort((x, y) => (y.unlockedOn ?? '').localeCompare(x.unlockedOn ?? '')).slice(0, 5)
  const nextName = level.to === undefined ? undefined : a.levels[nextLevelName(level.index)]

  const body = (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary bg-[image:var(--primary-paint)] text-primary-foreground shadow-md">
          <Dog className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{a.level(level.index)}</p>
          <p className="title text-xl leading-tight">{a.levels[level.name]}</p>
        </div>
        <div className="text-right">
          <p className="stat-value ml-auto text-xl font-bold tabular-nums">
            <CountUp value={a.points(points)} />
          </p>
          <p className="text-xs text-muted-foreground">{a.unlockedCount(unlocks.length, total)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div
          className="h-2.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={a.level(level.index)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div className="fill-bar animate-grow h-full rounded-full" style={{ width: `${share * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{nextName && level.to !== undefined ? a.toNext(level.to - points, nextName) : a.maxLevel}</p>
      </div>
      {link && recent.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="sr-only">{a.recent}</span>
          {recent.map((u) => (
            <Medal key={u.id} achievement={u.achievement} tier={u.tier} size="sm" className="animate-pop" />
          ))}
          <span className="ml-auto flex items-center gap-0.5 text-sm font-medium">
            {a.open}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        </div>
      )}
    </>
  )

  const classes = cn('surface flex flex-col gap-3 p-4', className)
  return link ? (
    <Link to="/achievements" className={cn(classes, 'transition-transform active:scale-[0.99]')}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  )
}

const nextLevelName = (index: number) => LEVELS[Math.min(index + 1, LEVELS.length - 1)]!
