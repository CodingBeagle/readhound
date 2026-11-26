import { Link } from 'react-router'

import { t } from '@/i18n'
import { HoundLogo } from '@/ui/brand/HoundLogo'
import { Button } from '@/ui/components/ui/button'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function NotFoundScreen() {
  return (
    <>
      <ScreenHeader title={t.notFound.title} />
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <HoundLogo variant="mark" motion="sniff" label={t.mascot} className="hound-flop size-36" />
        <p className="text-muted-foreground">{t.notFound.body}</p>
        <Button asChild variant="outline">
          <Link to="/">{t.notFound.backHome}</Link>
        </Button>
      </div>
    </>
  )
}
