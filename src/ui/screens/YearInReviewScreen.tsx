import { ChevronLeft, ChevronRight, Clock, Crown, Flame, Ruler, Star, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { yearInReview, type YearBook, type YearInReview } from '@/domain/stats'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { BookCover } from '@/ui/books/BookCover'
import { Button } from '@/ui/components/ui/button'
import { useStatsModel } from '@/ui/hooks/useStats'
import { formatNumber } from '@/ui/stats/format'
import { renderReviewImage, shareOrDownload } from '@/ui/stats/reviewImage'

const r = t.review
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'long' })

interface Card {
  id: string
  content: React.ReactNode
}

/** A full-screen, card-by-card look back at one year (design doc, Year in review). */
export function YearInReviewScreen() {
  const { year: yearParam = '' } = useParams()
  const year = Number(yearParam)
  const model = useStatsModel()
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const close = () => navigate('/stats', { replace: true })

  const review = model ? yearInReview(model, year) : undefined
  const cards = review ? buildCards(review) : []
  const last = cards.length - 1
  const go = (delta: number) => setIndex((i) => Math.max(0, Math.min(last, i + delta)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(last, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'Escape') navigate('/stats', { replace: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, navigate])

  // Swipe left or right on touch screens.
  const touchStart = useRef<number | null>(null)

  if (!model || !review) return null
  const card = cards[Math.min(index, last)]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={r.title(year)}
      className="fixed inset-0 z-30 flex flex-col bg-[#1c1917] text-[#fafaf9]"
      onPointerDown={(e) => (touchStart.current = e.clientX)}
      onPointerUp={(e) => {
        if (touchStart.current === null) return
        const dx = e.clientX - touchStart.current
        touchStart.current = null
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 gap-1" aria-hidden>
          {cards.map((c, i) => (
            <span key={c.id} className={cn('h-1 flex-1 rounded-full', i <= index ? 'bg-[#f59e0b]' : 'bg-white/20')} />
          ))}
        </div>
        <Button variant="ghost" size="icon" aria-label={r.close} onClick={close} className="text-inherit hover:bg-white/10">
          <X />
        </Button>
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8" aria-live="polite">
        <p className="sr-only">{r.progress(index + 1, cards.length)}</p>
        {card?.content}
      </div>

      <div className="mx-auto flex w-full max-w-md items-center justify-between px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button variant="ghost" onClick={() => go(-1)} disabled={index === 0} className="text-inherit hover:bg-white/10">
          <ChevronLeft />
          {r.previous}
        </Button>
        {index < last ? (
          <Button onClick={() => go(1)} className="bg-[#f59e0b] text-[#1c1917] hover:bg-[#f59e0b]/90">
            {r.next}
            <ChevronRight />
          </Button>
        ) : (
          <Button variant="ghost" onClick={close} className="text-inherit hover:bg-white/10">
            {r.close}
          </Button>
        )}
      </div>
    </div>
  )
}

function buildCards(review: YearInReview): Card[] {
  const { year } = review
  if (review.books === 0)
    return [
      {
        id: 'empty',
        content: <Big title={r.intro(year)} sub={r.empty(year)} />,
      },
    ]
  const cards: Card[] = [
    { id: 'intro', content: <Big title={r.intro(year)} sub={r.booksAndPages(review.books, formatNumber(review.pages))} /> },
    {
      id: 'totals',
      content: (
        <>
          <Heading>{r.totals}</Heading>
          <dl className="grid gap-6">
            <StatNumber label={r.booksRead} value={formatNumber(review.books)} note={review.books > review.uniqueBooks ? r.rereadNote(review.books - review.uniqueBooks) : undefined} />
            <StatNumber label={r.pagesRead} value={formatNumber(review.pages)} />
            <StatNumber label={r.readingDays} value={formatNumber(review.readingDays)} />
          </dl>
        </>
      ),
    },
  ]
  if (review.topAuthors.length) cards.push({ id: 'authors', content: <Ranked title={r.topAuthors} items={review.topAuthors} /> })
  if (review.topGenres.length) cards.push({ id: 'genres', content: <Ranked title={r.topGenres} items={review.topGenres} /> })
  if (review.longest && review.shortest)
    cards.push({
      id: 'sizes',
      content: (
        <>
          <Heading>{r.sizes}</Heading>
          <Highlight icon={<Ruler />} label={r.longest} book={review.longest} detail={r.pages(formatNumber(review.longest.pages ?? 0))} />
          {review.shortest.entryId !== review.longest.entryId && (
            <Highlight icon={<Ruler />} label={r.shortest} book={review.shortest} detail={r.pages(formatNumber(review.shortest.pages ?? 0))} />
          )}
        </>
      ),
    })
  if (review.fastest)
    cards.push({
      id: 'bests',
      content: (
        <>
          <Heading>{r.bests}</Heading>
          <Highlight icon={<Clock />} label={r.fastest} book={review.fastest} detail={r.inDays(review.fastest.days)} />
          {review.highestRated && (
            <Highlight icon={<Crown />} label={r.highestRated} book={review.highestRated} detail={<Stars rating={review.highestRated.rating ?? 0} />} />
          )}
        </>
      ),
    })
  if (review.streak.length > 1)
    cards.push({
      id: 'streak',
      content: (
        <>
          <Heading>{r.streak}</Heading>
          <p className="flex items-center gap-3 text-5xl font-bold text-[#f59e0b]">
            <Flame aria-hidden className="size-12" />
            {review.streak.length}
          </p>
          <p className="mt-2 text-xl">{r.streakDays(review.streak.length)}</p>
          <p className="mt-1 text-white/60">{r.streakRange(dateLabel(review.streak.from!), dateLabel(review.streak.to!))}</p>
        </>
      ),
    })
  if (review.first && review.last)
    cards.push({
      id: 'firstlast',
      content: (
        <>
          <Heading>{r.firstLast}</Heading>
          <Highlight label={r.first} book={review.first} detail={r.finishedOn(dateLabel(review.first.endedOn))} />
          {review.last.endedOn !== review.first.endedOn && <Highlight label={r.last} book={review.last} detail={r.finishedOn(dateLabel(review.last.endedOn))} />}
        </>
      ),
    })
  cards.push({ id: 'outro', content: <Outro review={review} /> })
  return cards
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 text-sm font-semibold tracking-widest text-white/60 uppercase">{children}</h2>
}

function Big({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <span aria-hidden className="mb-6 block h-2 w-16 rounded bg-[#f59e0b]" />
      <h1 className="text-4xl leading-tight font-bold">{title}</h1>
      <p className="mt-4 text-xl text-white/70">{sub}</p>
    </>
  )
}

function StatNumber({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-white/60">{label}</dt>
      <dd className="text-5xl font-bold text-[#f59e0b]">{value}</dd>
      {note && <dd className="text-sm text-white/60">{note}</dd>}
    </div>
  )
}

function Ranked({ title, items }: { title: string; items: { name: string; count: number }[] }) {
  return (
    <>
      <Heading>{title}</Heading>
      <ol className="flex flex-col gap-4">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-baseline gap-4">
            <span className="w-6 text-2xl font-bold text-[#f59e0b] tabular-nums">{i + 1}</span>
            <span className="flex-1 text-2xl font-semibold">{item.name}</span>
            <span className="text-white/60 tabular-nums">{item.count}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

function Highlight({ icon, label, book, detail }: { icon?: React.ReactNode; label: string; book: YearBook; detail: React.ReactNode }) {
  return (
    <div className="mb-6 flex gap-4">
      <BookCover url={book.coverUrl} title={book.title} className="w-16 shrink-0" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm text-white/60 [&_svg]:size-4">
          {icon}
          {label}
        </p>
        <p className="text-xl leading-snug font-semibold">{book.title}</p>
        <p className="text-sm text-white/60">{book.authors.join(', ')}</p>
        <p className="mt-1 text-[#f59e0b]">{detail}</p>
      </div>
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} / 5`}>
      {Array.from({ length: Math.floor(rating) }, (_, i) => (
        <Star key={i} aria-hidden className="size-4 fill-current" />
      ))}
      {rating % 1 ? '½' : ''}
    </span>
  )
}

function Outro({ review }: { review: YearInReview }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  return (
    <>
      <Big title={r.outro} sub={r.outroSub} />
      <Button
        size="lg"
        className="mt-8 bg-[#f59e0b] text-[#1c1917] hover:bg-[#f59e0b]/90"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy')
          try {
            await shareOrDownload(await renderReviewImage(review), `readhound-${review.year}.png`)
            setState('done')
          } catch {
            setState('idle')
          }
        }}
      >
        {state === 'busy' ? r.saving : r.save}
      </Button>
      <p role="status" className="mt-2 text-sm text-white/60">
        {state === 'done' ? r.saved : ''}
      </p>
    </>
  )
}
