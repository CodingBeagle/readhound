import { useState } from 'react'

import { FAMILY_RULES, TIERS, type AchievementGroup, type FamilyAchievement, type SpecialAchievement } from '@/domain/achievements'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { LevelCard } from '@/ui/achievements/LevelCard'
import { Medal } from '@/ui/achievements/Medal'
import { useAchievements } from '@/ui/achievements/useAchievements'
import { BackLink } from '@/ui/books/BackLink'
import { ChipToggle } from '@/ui/components/ChipToggle'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'
import { formatNumber } from '@/ui/stats/format'

const a = t.achievements
const GROUPS: Exclude<AchievementGroup, 'special'>[] = ['reading', 'habits', 'variety', 'collection']
type Filter = 'all' | 'unlocked' | 'locked'

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })

/** Every achievement: level and points on top, then tiered families by group and the one-off specials (design doc, Achievements). */
export function AchievementsScreen() {
  const summary = useAchievements()
  const [filter, setFilter] = useState<Filter>('all')
  if (!summary) return null

  const showFamily = (f: FamilyAchievement) => filter === 'all' || (filter === 'unlocked' ? f.tier !== undefined : f.next !== undefined)
  const showSpecial = (s: SpecialAchievement) => filter === 'all' || (filter === 'unlocked' ? s.unlocked : !s.unlocked)
  const specials = summary.specials.filter(showSpecial)

  return (
    <>
      <BackLink />
      <ScreenHeader title={a.title} />
      <p className="-mt-3 mb-4 text-sm text-muted-foreground">{a.intro}</p>
      <LevelCard summary={summary} link={false} className="animate-rise mb-5" />
      {summary.unlocks.length === 0 && <p className="mb-4 text-sm text-muted-foreground">{a.none}</p>}

      <div role="group" aria-label={a.filterLabel} className="mb-5 flex flex-wrap gap-2">
        {(['all', 'unlocked', 'locked'] as const).map((f) => (
          <ChipToggle key={f} pressed={filter === f} onClick={() => setFilter(f)}>
            {a.filters[f]}
          </ChipToggle>
        ))}
      </div>

      {GROUPS.map((group) => {
        const families = summary.families.filter((f) => f.group === group && showFamily(f))
        if (families.length === 0) return null
        return (
          <section key={group} aria-labelledby={`group-${group}`} className="mb-6">
            <h2 id={`group-${group}`} className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {a.groups[group]}
            </h2>
            <ul className="stagger flex flex-col gap-3">
              {families.map((f) => (
                <FamilyCard key={f.id} family={f} />
              ))}
            </ul>
          </section>
        )
      })}

      {specials.length > 0 && (
        <section aria-labelledby="group-special" className="mb-6">
          <h2 id="group-special" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {a.groups.special}
          </h2>
          <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
            {specials.map((s) => (
              <SpecialCard key={s.id} special={s} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function FamilyCard({ family: f }: { family: FamilyAchievement }) {
  const copy = a.families[f.id]
  const latest = [...f.tiers].reverse().find((t) => t.unlocked)
  const target = f.next?.threshold
  const previous = f.next ? (FAMILY_RULES[f.id].thresholds[TIERS.indexOf(f.next.tier) - 1] ?? 0) : 0
  const share = target === undefined ? 1 : Math.min(1, Math.max(0, (f.value - previous) / (target - previous)))
  return (
    <li className="surface flex gap-3 p-3">
      <Medal achievement={f.id} tier={f.tier} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="card-title font-semibold">{copy.name}</h3>
          <span className={cn('text-xs font-medium', f.tier ? 'text-foreground' : 'text-muted-foreground')}>{f.tier ? a.tiers[f.tier] : a.locked}</span>
        </div>
        <p className="text-sm text-muted-foreground">{f.next ? copy.goal(formatNumber(f.next.threshold)) : a.allDone}</p>
        <ol className="flex gap-1" aria-label={TIERS.map((tier, i) => `${a.tiers[tier]} ${f.tiers[i]!.unlocked ? a.unlocked : a.locked}`).join(', ')}>
          {f.tiers.map((tier) => (
            <li key={tier.tier} title={`${a.tiers[tier.tier]}: ${copy.goal(formatNumber(tier.threshold))}`} className={cn('h-1.5 flex-1 rounded-full', tier.unlocked ? `medal-${tier.tier}` : 'bg-muted')} />
          ))}
        </ol>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{target !== undefined ? a.progress(formatNumber(f.value), formatNumber(target)) : formatNumber(f.value)}</span>
          {latest?.unlockedOn && <span>{a.unlockedOn(dateLabel(latest.unlockedOn))}</span>}
        </div>
        {target !== undefined && (
          <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="fill-bar animate-grow h-full rounded-full" style={{ width: `${share * 100}%` }} />
          </div>
        )}
      </div>
    </li>
  )
}

function SpecialCard({ special: s }: { special: SpecialAchievement }) {
  const copy = a.specials[s.id]
  return (
    <li className={cn('surface flex flex-col items-center gap-2 p-3 text-center', !s.unlocked && 'opacity-80')}>
      <Medal achievement={s.id} tier={s.unlocked ? 'special' : undefined} />
      <h3 className="card-title text-sm font-semibold">{copy.name}</h3>
      <p className="text-xs text-muted-foreground">{copy.description}</p>
      <p className="mt-auto text-xs font-medium">
        {s.unlocked ? (s.unlockedOn ? a.unlockedOn(dateLabel(s.unlockedOn)) : a.unlocked) : s.progress ? a.progress(String(s.progress.value), String(s.progress.target)) : a.locked}
      </p>
    </li>
  )
}
