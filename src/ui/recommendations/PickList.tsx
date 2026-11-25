import { useState } from 'react'
import { Link } from 'react-router'

import type { Recommendation } from '@/domain/recommendations'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

import { PickCard } from './PickCard'
import { usePickActions } from './useRecommendations'

const r = t.recommendations

type Notice = { kind: 'added'; entryId: string; title: string } | { kind: 'dismissed'; workId: string; title: string }

/** The picks, with a status line that links to an added book or undoes a dismiss. */
export function PickList({ picks, compact = false }: { picks: Recommendation[]; compact?: boolean }) {
  const actions = usePickActions()
  const [notice, setNotice] = useState<Notice>()

  return (
    <>
      <ul className="stagger flex flex-col gap-3">
        {picks.map((pick) => (
          <PickCard
            key={pick.result.work.id}
            pick={pick}
            compact={compact}
            onAdded={(entryId, title) => setNotice({ kind: 'added', entryId, title })}
            onDismiss={(workId, title) => {
              setNotice({ kind: 'dismissed', workId, title })
              void actions.dismiss(workId)
            }}
          />
        ))}
      </ul>
      <div role="status" className="mt-2 min-h-5 text-sm">
        {notice?.kind === 'added' && (
          <span className="animate-rise flex flex-wrap items-center gap-2">
            {r.added(notice.title)}
            <Link to={`/book/${notice.entryId}`} className="font-medium underline">
              {r.openBook}
            </Link>
          </span>
        )}
        {notice?.kind === 'dismissed' && (
          <span className="animate-rise flex flex-wrap items-center gap-2">
            {r.dismissed(notice.title)}
            <Button
              size="sm"
              variant="ghost"
              className="underline"
              onClick={() => {
                void actions.undismiss(notice.workId)
                setNotice(undefined)
              }}
            >
              {r.undo}
            </Button>
          </span>
        )}
      </div>
    </>
  )
}
