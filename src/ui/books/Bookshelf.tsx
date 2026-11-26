import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type { BookView } from '@/domain/bookView'
import { packShelves, rgbCss, spineHeightRatio, spineInk, spineWidth } from '@/domain/spines'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/components/ui/button'

import { BookCover } from './BookCover'
import { OwnedBadge } from './OwnedControl'
import { StatusBadge } from './StatusBadge'
import { useSpineColour } from './useSpineColour'

/** Inner height of a shelf in CSS pixels; spines are 78–98 % of it. */
const SHELF_HEIGHT = 176
const SPINE_GAP = 2
/** Side walls plus the shelf's inner padding. */
const CASE_INSET = 2 * 10 + 2 * 8
const FALLBACK_WIDTH = 360

const authorLine = (book: BookView) => book.authorNames.join(', ') || t.common.unknownAuthor
const surname = (book: BookView) => book.authorNames[0]?.split(' ').at(-1) ?? ''

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => el.clientWidth > 0 && setWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * The library as book spines on a bookcase (design doc, Bookshelf). Spines
 * keep the library's filter and sort order. Tapping one pulls the book out
 * and turns it to show the cover; from there it opens.
 */
export function Bookshelf({ books }: { books: BookView[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [pulled, setPulled] = useState<BookView | null>(null)
  const shelves = useMemo(
    () => packShelves(books.map((b) => spineWidth(b.edition.pageCount)), Math.max(80, width - CASE_INSET), SPINE_GAP).map((idx) => idx.map((i) => books[i]!)),
    [books, width],
  )

  return (
    <div ref={ref} className="bookcase" data-testid="bookshelf">
      <ul aria-label={t.shelf.label} className="flex flex-col">
        {shelves.map((row, i) => (
          <li key={i} className="shelf">
            <div className="shelf-back" style={{ height: SHELF_HEIGHT }}>
              <ul className="flex h-full items-end" style={{ gap: SPINE_GAP }}>
                {row.map((book) => (
                  <li key={book.entry.id} className="flex items-end">
                    <Spine book={book} hidden={pulled?.entry.id === book.entry.id} onPull={() => setPulled(book)} />
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden className="shelf-plank">
              <div className="shelf-plank-top" />
              <div className="shelf-plank-front" />
            </div>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {pulled && <PulledBook key={pulled.entry.id} book={pulled} onClose={() => setPulled(null)} />}
      </AnimatePresence>
    </div>
  )
}

const spineKey = (book: BookView) => book.edition.title + book.entry.id

function Spine({ book, hidden, onPull }: { book: BookView; hidden: boolean; onPull: () => void }) {
  const key = spineKey(book)
  const colour = useSpineColour(book.edition.coverUrl, key)
  const w = spineWidth(book.edition.pageCount)
  const h = Math.round(SHELF_HEIGHT * spineHeightRatio(key))
  const ink = spineInk(colour)
  const titleSize = w < 22 ? 10 : w < 34 ? 11.5 : 13
  return (
    <button
      type="button"
      className={cn('spine', hidden && 'spine-pulled')}
      data-ink={ink}
      data-status={book.entry.status}
      style={{ width: w, height: h, backgroundColor: rgbCss(colour) }}
      aria-label={t.shelf.spine(book.edition.title, authorLine(book))}
      onClick={onPull}
    >
      {book.entry.status === 'reading' && <span aria-hidden className="spine-ribbon" />}
      <span aria-hidden className="spine-band spine-band-top" />
      <span aria-hidden className="spine-title" style={{ fontSize: titleSize }}>
        {book.edition.title}
      </span>
      {w >= 22 && (
        <span aria-hidden className="spine-author">
          {surname(book)}
        </span>
      )}
      <span aria-hidden className="spine-band spine-band-bottom" />
    </button>
  )
}

function PulledBook({ book, onClose }: { book: BookView; onClose: () => void }) {
  const colour = useSpineColour(book.edition.coverUrl, spineKey(book))
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const openRef = useRef<HTMLAnchorElement>(null)
  const href = `/book/${book.entry.id}`
  const depth = Math.max(14, Math.round(spineWidth(book.edition.pageCount) * 0.9))
  const spineBg = rgbCss(colour)

  useEffect(() => {
    openRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="pulled-title" className="relative flex w-full max-w-xs flex-col items-center gap-4">
        <div style={{ perspective: 1000 }}>
          <motion.button
            type="button"
            className="pulled-book"
            style={{ ['--depth' as string]: `${depth}px`, ['--spine' as string]: spineBg }}
            aria-label={t.shelf.open(book.edition.title)}
            onClick={() => navigate(href)}
            initial={reduce ? false : { rotateY: 88, y: 60, scale: 0.6 }}
            animate={reduce ? undefined : { rotateY: [88, -14, -6], y: 0, scale: 1 }}
            exit={reduce ? undefined : { rotateY: 88, y: 60, scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], times: [0, 0.75, 1] }}
          >
            <span className="pulled-book-cover">
              {book.edition.coverUrl ? (
                <BookCover url={book.edition.coverUrl} title={book.edition.title} className="size-full rounded-none rounded-r-md" />
              ) : (
                // No cover: a cloth binding in the spine's colour with the title stamped on it.
                <span className="cloth-cover" data-ink={spineInk(colour)}>
                  <span className="spine-band" />
                  <span className="cloth-cover-title">{book.edition.title}</span>
                  <span className="cloth-cover-author">{authorLine(book)}</span>
                  <span className="spine-band spine-band-bottom" />
                </span>
              )}
            </span>
            <span aria-hidden className="pulled-book-spine" />
            <span aria-hidden className="pulled-book-pages" />
          </motion.button>
        </div>
        <motion.div
          className="surface w-full rounded-xl p-4 text-center"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.35, duration: 0.3 }}
        >
          <h2 id="pulled-title" className="leading-tight font-semibold">
            {book.edition.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{authorLine(book)}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <StatusBadge status={book.entry.status} />
            {book.entry.owned && <OwnedBadge />}
            {book.edition.pageCount ? <span className="text-xs text-muted-foreground">{t.shelf.pages(book.edition.pageCount)}</span> : null}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t.shelf.putBack}
            </Button>
            <Button asChild className="flex-1">
              <Link ref={openRef} to={href}>
                {t.shelf.openBook}
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
