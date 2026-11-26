import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen } from 'lucide-react'

import { useServices } from '@/app/services'
import { coverIdFromRef, isLocalCoverRef } from '@/domain/covers'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

interface CoverProps {
  url?: string
  title: string
  className?: string
}

/**
 * A cover image with a 2:3 placeholder when there is none or it fails to load.
 * A `readhound-cover:` reference is a cover photo stored on the device.
 */
export function BookCover(props: CoverProps) {
  return isLocalCoverRef(props.url) ? <StoredCover {...props} url={props.url} /> : <CoverImage {...props} />
}

function StoredCover({ url, ...rest }: CoverProps & { url: string }) {
  const { db } = useServices()
  const id = coverIdFromRef(url)
  const dataUrl = useLiveQuery(async () => (id ? ((await db.covers.get(id))?.dataUrl ?? null) : null), [db, id], 'loading' as const)
  if (dataUrl === 'loading') return <CoverImage {...rest} pending />
  return <CoverImage {...rest} url={dataUrl ?? undefined} />
}

function CoverImage({ url, title, className, pending }: CoverProps & { pending?: boolean }) {
  return (
    <div className={cn('relative aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-muted', className)}>
      {url ? (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          className="relative z-[1] size-full object-cover opacity-0 transition-opacity duration-500"
          onLoad={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
      <div className="absolute inset-0 -z-0 flex items-center justify-center text-muted-foreground" aria-hidden={Boolean(url)}>
        {!url && !pending && <BookOpen className="size-6" aria-label={`${t.common.noCover}: ${title}`} />}
      </div>
    </div>
  )
}
