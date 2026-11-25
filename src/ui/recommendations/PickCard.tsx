import { BookmarkPlus, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type { Recommendation } from '@/domain/recommendations'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { BookCover } from '@/ui/books/BookCover'
import { Button } from '@/ui/components/ui/button'

import { reasonText } from './reasonText'
import { usePickActions } from './useRecommendations'

const r = t.recommendations

export interface PickHandlers {
  onDismiss: (workId: string, title: string) => void
  /** Called once the book is in the library; the pick then drops out of the list. */
  onAdded: (entryId: string, title: string) => void
}

/** One suggested book: why it was picked, add to To read in one tap, or "not for me". */
export function PickCard({ pick, onDismiss, onAdded, compact = false }: { pick: Recommendation; compact?: boolean } & PickHandlers) {
  const { result, reason } = pick
  const actions = usePickActions()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const workLink = `/search/work/${result.work.id}`
  const meta = [result.firstPublishYear, result.medianPageCount && t.common.pages(result.medianPageCount)].filter(Boolean).join(' · ')

  async function add() {
    setAdding(true)
    let entryId: string | undefined
    try {
      entryId = await actions.addToRead(result)
    } catch {
      entryId = undefined
    }
    if (entryId) onAdded(entryId, result.title)
    else {
      setAdding(false)
      void navigate(workLink, { state: { result } })
    }
  }

  return (
    <li className={cn('surface flex gap-3 p-3', adding && 'opacity-80')}>
      <Link to={workLink} state={{ result }} className="shrink-0" aria-hidden tabIndex={-1}>
        <BookCover url={result.coverUrl} title={result.title} className={compact ? 'w-14' : 'w-16'} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link to={workLink} state={{ result }} className="card-title leading-snug font-semibold hover:underline">
          {result.title}
        </Link>
        <span className="text-sm text-muted-foreground">{result.authors.map((a) => a.name).join(', ')}</span>
        <span className="flex items-start gap-1.5 text-xs font-medium">
          <Sparkles aria-hidden className="mt-px size-3.5 shrink-0 text-primary" />
          {reasonText(reason)}
        </span>
        {!compact && meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void add()} disabled={adding} aria-label={`${r.addToRead}: ${result.title}`}>
            <BookmarkPlus aria-hidden />
            {adding ? r.adding : r.addToRead}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss(result.work.id, result.title)} disabled={adding} aria-label={`${r.dismiss}: ${result.title}`}>
            <X aria-hidden />
            {r.dismiss}
          </Button>
        </div>
      </div>
    </li>
  )
}
