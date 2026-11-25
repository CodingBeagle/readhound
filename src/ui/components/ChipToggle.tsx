import { Check } from 'lucide-react'

import { Button } from '@/ui/components/ui/button'

/** A pill-shaped on/off button for picking lists, categories and filters. */
export function ChipToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant={pressed ? 'default' : 'outline'} aria-pressed={pressed} onClick={onClick} className="rounded-full" type="button">
      {pressed && <Check aria-hidden />}
      {children}
    </Button>
  )
}
