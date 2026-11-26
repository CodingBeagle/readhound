import { BookOpen, Check, Download, Flame, Lock, ScanBarcode, Search, Smartphone, Trophy, Upload, WifiOff } from 'lucide-react'
import { motion, MotionConfig } from 'motion/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

import { HoundLogo } from '@/ui/brand/HoundLogo'
import { WalkingHound } from '@/ui/brand/BarkingBeagle'
import { playBark, primeBarkAudio } from '@/ui/motion/bookAddedBark'

import { landing as l } from './copy'

const base = import.meta.env.BASE_URL
const APP_URL = base
const DEMO_URL = `${base}demo`

type ChapterId = (typeof l.chapters)[number]['id']

/**
 * The Readhound landing page (design doc, Landing page): a single scrolling
 * story in the Midnight theme. Zico trots in and introduces himself, then
 * walks the visitor through what the app does, one chapter at a time.
 * It is its own small Vite entry (`welcome/index.html`), so the app is untouched.
 */
export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing">
        <a href={APP_URL} className="landing-skip">
          {l.skip}
        </a>
        <header className="landing-bar">
          <a href={APP_URL} className="flex items-center gap-2 font-bold">
            <HoundLogo className="size-8" motion="none" />
            Readhound
          </a>
          <a href={APP_URL} className="landing-button landing-button-small">
            {l.openApp}
          </a>
        </header>
        <main>
          <Hero />
          {l.chapters.map((chapter, i) => (
            <Chapter key={chapter.id} chapter={chapter} flip={i % 2 === 1}>
              <Visual id={chapter.id} />
            </Chapter>
          ))}
          <Finale />
        </main>
        <footer className="landing-footer">{l.footer}</footer>
      </div>
    </MotionConfig>
  )
}

/** Zico trots in, barks, then introduces himself line by line. Tapping him makes him bark again. */
function Hero() {
  const [barks, setBarks] = useState(0)
  const bark = () => {
    primeBarkAudio()
    playBark()
    setBarks((n) => n + 1)
  }
  return (
    <section className="landing-hero" aria-labelledby="landing-hello">
      <div className="landing-stage">
        <button type="button" className="landing-zico" onClick={bark} aria-label={l.hero.tapMe} data-testid="landing-zico">
          <span key={barks} className={barks ? 'landing-zico-rebark' : 'landing-zico-arrive'}>
            <span className="landing-woof" aria-hidden>
              {l.hero.woof}
            </span>
            <WalkingHound />
          </span>
        </button>
      </div>
      <div className="landing-speech">
        <h1 id="landing-hello" className="landing-speech-line landing-title">
          {l.hero.lines[0]}
        </h1>
        {l.hero.lines.slice(1).map((line, i) => (
          <p key={line} className="landing-speech-line" style={{ animationDelay: `${2.9 + i * 0.6}s` }}>
            {line}
          </p>
        ))}
      </div>
      <p className="landing-pitch">{l.hero.pitch}</p>
      <div className="landing-actions landing-pitch">
        <a href={APP_URL} className="landing-button">
          {l.openApp}
        </a>
        <a href="#find" className="landing-link">
          {l.hero.tour} <span className="landing-arrow">↓</span>
        </a>
      </div>
    </section>
  )
}

function Chapter({ chapter, flip, children }: { chapter: (typeof l.chapters)[number]; flip: boolean; children: ReactNode }) {
  return (
    <section id={chapter.id} className="landing-chapter" data-flip={flip || undefined} aria-labelledby={`${chapter.id}-title`}>
      <Reveal className="landing-copy">
        <p className="landing-kicker">{chapter.kicker}</p>
        <h2 id={`${chapter.id}-title`} className="landing-h2">
          {chapter.title}
        </h2>
        <p className="landing-body">{chapter.body}</p>
        {chapter.points.length > 0 && (
          <ul className="landing-points">
            {chapter.points.map((point) => (
              <li key={point}>
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      <Reveal className="landing-visual" delay={0.12}>
        {children}
      </Reveal>
    </section>
  )
}

/** Fades content up as it scrolls into view (just appears with reduced motion). */
function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 0.9, 0.4, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Visual({ id }: { id: ChapterId }) {
  switch (id) {
    case 'find':
      return <FindVisual />
    case 'sort':
      return <SortVisual />
    case 'shelf':
      return <ShelfVisual />
    case 'series':
      return <SeriesVisual />
    case 'stats':
      return <StatsVisual />
    case 'cheer':
      return <CheerVisual />
    case 'outfits':
      return <OutfitsVisual />
    case 'private':
      return <PrivateVisual />
  }
}

function FindVisual() {
  return (
    <div className="landing-card landing-find" aria-hidden>
      <div className="landing-search">
        <Search className="size-4" />
        <span className="landing-typed">{l.search}</span>
      </div>
      <div className="landing-barcode">
        <ScanBarcode className="landing-barcode-icon" />
        <div className="landing-bars" />
        <div className="landing-laser" />
      </div>
      <div className="landing-chip-row">
        <span className="landing-chip">
          <Upload className="size-3.5" /> Goodreads
        </span>
        <span className="landing-chip">
          <BookOpen className="size-3.5" /> Open Library
        </span>
      </div>
    </div>
  )
}

const STATUS_COLOURS = ['#22d3ee', '#a3e635', '#a78bfa', '#fb7185']
const PILE_SIZES = [4, 2, 5, 1]

function SortVisual() {
  return (
    <div className="landing-card landing-piles" aria-hidden>
      {l.statuses.map((status, i) => (
        <div key={status} className="landing-pile" style={{ '--pile': STATUS_COLOURS[i], '--delay': `${i * 0.12}s` } as CSSProperties}>
          <div className="landing-pile-stack">
            {Array.from({ length: PILE_SIZES[i] ?? 1 }, (_, n) => (
              <span key={n} style={{ '--n': n } as CSSProperties} />
            ))}
          </div>
          <span className="landing-pile-label">{status}</span>
        </div>
      ))}
    </div>
  )
}

/** Spine colours and widths for the little shelf (pages decide the width in the app). */
const SPINES = [
  ['#fb7185', 34],
  ['#22d3ee', 26],
  ['#a3e635', 40],
  ['#f97316', 22],
  ['#a78bfa', 30],
  ['#facc15', 36],
  ['#38bdf8', 24],
  ['#f472b6', 32],
  ['#34d399', 28],
] as const

function ShelfVisual() {
  return (
    <div className="landing-card landing-shelf-card" aria-hidden>
      <div className="landing-shelf">
        {SPINES.map(([colour, width], i) => (
          <span
            key={colour}
            className="landing-spine"
            data-pulled={i === 2 || undefined}
            style={{ '--spine': colour, width, height: 118 + ((i * 17) % 34) } as CSSProperties}
          />
        ))}
      </div>
      <div className="landing-plank" />
    </div>
  )
}

function SeriesVisual() {
  return (
    <div className="landing-card landing-series" aria-hidden>
      {[1, 2, 3].map((n) => (
        <div key={n} className="landing-volume" data-next={n === 3 || undefined}>
          <span className="landing-volume-cover">{n}</span>
          {n < 3 ? <Check className="landing-volume-done" /> : <span className="landing-volume-next">{l.next}</span>}
        </div>
      ))}
    </div>
  )
}

const BARS = [42, 58, 35, 74, 66, 92]

function StatsVisual() {
  return (
    <div className="landing-card landing-stats" aria-hidden>
      <div className="landing-streak">
        <Flame className="size-5" /> <span className="landing-number">23</span> day streak
      </div>
      <div className="landing-chart">
        {BARS.map((h, i) => (
          <div key={l.months[i]} className="landing-chart-col">
            <motion.span
              className="landing-chart-bar"
              style={{ height: `${h}%` }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: [0.22, 0.9, 0.4, 1] }}
            />
            <span className="landing-chart-label">{l.months[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CheerVisual() {
  const [quote, setQuote] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setQuote((q) => (q + 1) % l.quotes.length), 6000)
    return () => clearInterval(timer)
  }, [])
  const q = l.quotes[quote] ?? l.quotes[0]
  return (
    <div className="landing-card landing-cheer" aria-hidden>
      <div className="landing-goal">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">{l.goal.label}</span>
          <span className="text-muted-foreground">{l.goal.pages}</span>
        </div>
        <div className="landing-goal-track">
          <motion.span
            className="landing-goal-fill"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 0.82 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 0.9, 0.4, 1] }}
          />
        </div>
      </div>
      <div className="landing-badges">
        {l.achievements.map((a) => (
          <span key={a} className="landing-badge">
            <Trophy className="size-4" /> {a}
          </span>
        ))}
      </div>
      <div className="landing-quote">
        <HoundLogo className="size-14" variant="badge" />
        <blockquote key={quote} className="landing-quote-bubble">
          “{q.text}”<cite>{q.source}</cite>
        </blockquote>
      </div>
    </div>
  )
}

function OutfitsVisual() {
  return (
    <div className="landing-card landing-outfits" aria-hidden>
      <figure>
        <HoundLogo className="size-24" />
        <figcaption>{l.outfits.day}</figcaption>
      </figure>
      <figure>
        <HoundLogo className="size-24" outfit="pyjamas" />
        <figcaption>{l.outfits.night}</figcaption>
      </figure>
      <figure>
        <HoundLogo className="size-24" outfit="santa" />
        <figcaption>{l.outfits.december}</figcaption>
      </figure>
      <div className="landing-snow" />
    </div>
  )
}

function PrivateVisual() {
  return (
    <div className="landing-card landing-private" aria-hidden>
      <div className="landing-phone">
        <Smartphone className="landing-phone-icon" />
        <Lock className="landing-lock" />
      </div>
      <div className="landing-chip-row">
        <span className="landing-chip">
          <WifiOff className="size-3.5" /> Offline
        </span>
        <span className="landing-chip">
          <Download className="size-3.5" /> Backup saved
        </span>
      </div>
    </div>
  )
}

function Finale() {
  return (
    <section className="landing-finale" aria-labelledby="landing-end">
      <Reveal>
        <HoundLogo className="mx-auto size-28" motion="peek" />
        <h2 id="landing-end" className="landing-h2 mt-6">
          {l.end.title}
        </h2>
        <p className="landing-body mx-auto">{l.end.body}</p>
        <div className="landing-actions justify-center">
          <a href={APP_URL} className="landing-button" data-testid="landing-open-app">
            {l.openApp}
          </a>
          <a href={DEMO_URL} className="landing-link">
            {l.tryDemo}
          </a>
        </div>
      </Reveal>
    </section>
  )
}
