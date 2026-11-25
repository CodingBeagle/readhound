import { Check } from 'lucide-react'

import type { MemberState, SeriesMemberView, SeriesView } from '@/domain/series'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { BookCover } from '@/ui/books/BookCover'
import { ProgressBar } from '@/ui/books/ProgressBar'

const s = t.series

/** "4 of 7 read" with a bar; a check when the series is complete. */
export function SeriesProgress({ view, className }: { view: SeriesView; className?: string }) {
  const label = view.complete ? s.complete : s.progress(view.finished, view.total)
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <ProgressBar value={view.total ? view.finished / view.total : 0} label={label} />
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {view.complete && <Check aria-hidden className="size-3.5 text-primary" />}
        {label}
      </span>
    </div>
  )
}

const STATE_STYLES: Record<MemberState, string> = {
  finished: 'bg-primary text-primary-foreground',
  reading: 'bg-accent text-accent-foreground',
  to_read: 'bg-secondary text-secondary-foreground',
  dnf: 'border text-muted-foreground',
  missing: 'border border-dashed text-muted-foreground',
}

export function MemberStateBadge({ state }: { state: MemberState }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATE_STYLES[state])}>{s.states[state]}</span>
}

/** A cover in a series strip; books not in the library are shown faded with a dashed outline. */
export function MemberCover({ member, className }: { member: SeriesMemberView; className?: string }) {
  return (
    <BookCover
      url={member.book?.edition.coverUrl}
      title={member.title}
      className={cn(member.state === 'missing' && 'opacity-45 outline-2 -outline-offset-2 outline-dashed outline-border', member.state === 'finished' && 'ring-2 ring-primary/60', className)}
    />
  )
}

