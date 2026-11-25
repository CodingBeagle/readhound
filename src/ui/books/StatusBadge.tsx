import type { Status } from '@/domain/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const styles: Record<Status, string> = {
  to_read: 'bg-secondary text-secondary-foreground',
  reading: 'bg-accent text-accent-foreground',
  finished: 'bg-primary text-primary-foreground',
  dnf: 'border text-muted-foreground',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[status], className)}>
      {t.status[status]}
    </span>
  )
}
