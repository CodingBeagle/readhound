import type { EditionFormat } from '@/domain/types'
import { t } from '@/i18n'
import { Select } from '@/ui/components/ui/input'

const FORMATS = Object.keys(t.formats) as EditionFormat[]

/**
 * "I own this book" with the format of my copy. Owning is a flag next to the
 * reading status, not a status of its own, so any status can be owned.
 */
export function OwnedControl({
  owned,
  format,
  onOwned,
  onFormat,
}: {
  owned: boolean
  format?: EditionFormat
  onOwned: (owned: boolean) => void
  onFormat: (format: EditionFormat | undefined) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--chart-1)]" checked={owned} onChange={(e) => onOwned(e.target.checked)} />
        <span>
          <span className="font-medium">{t.owned.own}</span>
          <span className="block text-xs text-muted-foreground">{t.owned.ownHint}</span>
        </span>
      </label>
      {owned && (
        <Select aria-label={t.owned.format} value={format ?? ''} onChange={(e) => onFormat((e.target.value || undefined) as EditionFormat | undefined)} className="w-48">
          <option value="">{t.owned.unknownFormat}</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t.formats[f]}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}

export function OwnedBadge({ className = '' }: { className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{t.owned.badge}</span>
}
