import { Sparkles } from 'lucide-react'

import type { ShownSuggestion } from '@/db/genres'
import type { GenreId } from '@/domain/genres'
import { t } from '@/i18n'
import { ChipToggle } from '@/ui/components/ChipToggle'

import { sourcesText } from './genreText'

const gt = t.genres

/** Suggested genres as chips: pressed ones will be set. A chip for a genre the reader has no category for says it will be added. */
export function GenreSuggestionChips({
  suggestions,
  selected,
  onToggle,
  label = gt.suggested,
}: {
  suggestions: readonly ShownSuggestion[] | undefined
  selected: ReadonlySet<GenreId>
  onToggle: (genre: GenreId, on: boolean) => void
  label?: string
}) {
  if (suggestions === undefined)
    return (
      <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles aria-hidden className="size-3.5" />
        {gt.looking}
      </p>
    )
  if (suggestions.length === 0) return null
  return (
    <div role="group" aria-label={label} className="animate-rise flex flex-wrap items-center gap-2">
      <span className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles aria-hidden className="size-3.5 text-primary" />
        {label}
      </span>
      {suggestions.map((s) => (
        <ChipToggle key={s.genre} pressed={selected.has(s.genre)} onClick={() => onToggle(s.genre, !selected.has(s.genre))}>
          {s.name}
          {!s.categoryId && <span className="text-[0.65rem] font-normal opacity-75">{gt.newCategory}</span>}
        </ChipToggle>
      ))}
      <span className="w-full text-xs text-muted-foreground">{sourcesText(suggestions)}</span>
    </div>
  )
}
