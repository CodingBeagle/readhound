import { Link } from 'react-router'

import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'

export function NotFoundScreen() {
  return (
    <>
      <ScreenHeader title={t.notFound.title} />
      <Button asChild variant="outline">
        <Link to="/">{t.notFound.backHome}</Link>
      </Button>
    </>
  )
}
