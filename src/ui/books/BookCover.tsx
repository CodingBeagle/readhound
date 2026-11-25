import { BookOpen } from 'lucide-react'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** A cover image with a 2:3 placeholder when there is none or it fails to load. */
export function BookCover({ url, title, className }: { url?: string; title: string; className?: string }) {
  return (
    <div className={cn('relative aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-muted', className)}>
      {url ? (
        <img
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
        {!url && <BookOpen className="size-6" aria-label={`${t.common.noCover}: ${title}`} />}
      </div>
    </div>
  )
}
