import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'

export function BackLink() {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" size="sm" className="-ml-3 mb-2" onClick={() => navigate(-1)}>
      <ChevronLeft />
      {t.common.back}
    </Button>
  )
}
