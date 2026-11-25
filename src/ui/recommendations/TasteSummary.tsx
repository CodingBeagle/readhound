import type { ProfileEntry, TasteProfile } from '@/domain/recommendations'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const r = t.recommendations

const strongest = (map: Map<string, ProfileEntry>, n: number) =>
  [...map.values()]
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)

/** What the profile has learned, so the picks are explainable. */
export function TasteSummary({ profile, className }: { profile: TasteProfile; className?: string }) {
  const authors = strongest(profile.authors, 5)
  const subjects = strongest(profile.subjects, 6)
  if (authors.length === 0 && subjects.length === 0) return null
  return (
    <section aria-labelledby="taste" className={cn('surface flex flex-col gap-3 p-4', className)}>
      <h2 id="taste" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {r.tasteTitle}
      </h2>
      <Chips label={r.tasteAuthors} items={authors} />
      <Chips label={r.tasteSubjects} items={subjects} />
    </section>
  )
}

function Chips({ label, items }: { label: string; items: ProfileEntry[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium">{label}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((e) => (
          <li key={e.label} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {e.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
