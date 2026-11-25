import type { Reason } from '@/domain/recommendations'
import { t } from '@/i18n'

const r = t.recommendations

/** The one-line "why" under a pick. */
export function reasonText(reason: Reason): string {
  switch (reason.kind) {
    case 'author':
      return r.because.author(reason.author, reason.book)
    case 'subject':
      return r.because.subject(reason.subject, reason.book)
  }
}
