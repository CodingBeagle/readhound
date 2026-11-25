import { useState } from 'react'

import { useServices } from '@/app/services'
import type { BookView } from '@/domain/bookView'
import { parsePageInput } from '@/domain/sessions'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'

/** Quick "I'm on page N" input; also accepts a percentage. Offers "Mark as finished" at the last page. */
export function LogPageForm({ book }: { book: BookView }) {
  const { library } = useServices()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const [reachedEnd, setReachedEnd] = useState(false)
  const [message, setMessage] = useState<string>()
  const id = `log-${book.entry.id}`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const page = parsePageInput(value, book.edition.pageCount)
    if (page === null) return setError(t.screens.log.invalid)
    const result = await library.logPage(book.entry.id, page)
    if (!result.ok) return setError(result.error.message)
    setError(undefined)
    setValue('')
    setMessage(t.screens.log.logged(result.session.pagesRead))
    setReachedEnd(result.reachedEnd)
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex items-end gap-2">
        <label htmlFor={id} className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {t.screens.log.label}
          <Input
            id={id}
            inputMode="numeric"
            placeholder={String(book.currentPage || '')}
            value={value}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-msg`}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={!value.trim()}>
          {t.screens.log.submit}
        </Button>
      </form>
      <p id={`${id}-msg`} role={error ? 'alert' : 'status'} className={error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
        {error ?? message ?? t.screens.log.hint}
      </p>
      {reachedEnd && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-2 text-sm">
          <span>{t.screens.log.reachedEnd}</span>
          <Button size="sm" onClick={() => library.changeStatus(book.entry.id, 'finished').then(() => setReachedEnd(false))}>
            {t.screens.log.markFinished}
          </Button>
        </div>
      )}
    </div>
  )
}
