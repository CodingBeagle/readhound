import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { useServices } from '@/app/services'
import { SETTING_SERIES_DISMISSED } from '@/db'
import type { BookView } from '@/domain/bookView'
import { formatPosition } from '@/domain/series'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

const s = t.series

/**
 * "Part of a series?": looks the book up on Wikidata (then Open Library)
 * while it has no series, and offers what it finds with one tap to add.
 * Quiet when nothing is found or the lookup fails.
 */
export function SeriesSuggestion({ book }: { book: BookView }) {
  const { db, series, seriesDetector } = useServices()
  const workId = book.edition.workId
  const work = book.work?.sourceRef
  const edition = book.edition.sourceRef
  const dismissed = useLiveQuery(async () => ((await db.settings.get(SETTING_SERIES_DISMISSED))?.value as string[] | undefined)?.includes(workId) ?? false, [db, workId])
  const [busy, setBusy] = useState(false)
  const enabled = dismissed === false && book.series.length === 0 && (work?.source === 'openlibrary' || edition?.source === 'openlibrary')
  const { data } = useQuery({
    queryKey: ['series-detect', work?.id, edition?.id],
    queryFn: ({ signal }) => seriesDetector.detect({ work, edition }, signal),
    enabled,
    staleTime: Infinity,
  })
  if (!enabled || !data?.length) return null

  return (
    <div className="animate-rise flex flex-col gap-2 rounded-[var(--radius)] border border-dashed p-3" role="region" aria-label={s.suggestion}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Sparkles aria-hidden className="size-4 text-primary" />
        {s.suggestion}
      </p>
      <ul className="flex flex-col gap-2">
        {data.slice(0, 3).map((candidate) => (
          <li key={`${candidate.origin}-${candidate.wikidataId ?? candidate.name}`} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{s.suggestionLine(candidate.name, formatPosition(candidate.position))}</span>
              <span className="block text-xs text-muted-foreground">{s.suggestionSource[candidate.origin]}</span>
            </span>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await series.applyCandidate(workId, candidate)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {s.accept}
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button size="sm" variant="ghost" onClick={() => void series.dismissSuggestions(workId)}>
          {s.dismiss}
        </Button>
      </div>
    </div>
  )
}
