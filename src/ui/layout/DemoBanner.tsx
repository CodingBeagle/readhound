import { FlaskConical } from 'lucide-react'
import { Link } from 'react-router'

import { useDemo } from '@/app/services'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

/** Always visible in demo mode, so sample data is never mistaken for the real library. */
export function DemoBanner() {
  const demo = useDemo()
  if (!demo.active) return null
  return (
    <div role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-accent px-3 py-1 text-sm text-accent-foreground">
      <FlaskConical aria-hidden className="size-4 shrink-0" />
      <Link to="/demo" className="flex-1 py-2 font-medium underline-offset-4 hover:underline">
        {t.demo.banner}
      </Link>
      <Button size="sm" variant="ghost" className="-mr-2 hover:bg-black/10" onClick={demo.leave}>
        {t.demo.leave}
      </Button>
    </div>
  )
}
