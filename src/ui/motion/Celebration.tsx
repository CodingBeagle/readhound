import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import type { Status } from '@/domain/types'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-7)']
const PIECES = Array.from({ length: 36 }, (_, i) => {
  // Fixed pseudo-random spread so every burst looks the same and renders are pure.
  const angle = (i / 36) * Math.PI * 2 + ((i * 37) % 11) / 20
  const distance = 120 + ((i * 53) % 90)
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 60,
    rotate: ((i * 97) % 360) - 180,
    color: COLORS[i % COLORS.length]!,
    round: i % 3 === 0,
  }
})

/** A short confetti burst when a book's status turns to Finished (design doc, Animation). */
export function FinishCelebration({ status }: { status: Status }) {
  const previous = useRef(status)
  const [burst, setBurst] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (previous.current !== 'finished' && status === 'finished' && !reduce) setBurst((n) => n + 1)
    previous.current = status
  }, [status, reduce])

  useEffect(() => {
    if (!burst) return
    const timer = setTimeout(() => setBurst(0), 1600)
    return () => clearTimeout(timer)
  }, [burst])

  return (
    <AnimatePresence>
      {burst > 0 && (
        <motion.div key={burst} aria-hidden className="pointer-events-none fixed inset-0 z-40 grid place-items-center" exit={{ opacity: 0 }}>
          {PIECES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute"
              style={{ width: p.round ? 9 : 7, height: p.round ? 9 : 12, borderRadius: p.round ? 999 : 2, background: p.color }}
              initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
              animate={{ x: p.x, y: [0, p.y, p.y + 220], scale: [0, 1.1, 0.9], rotate: p.rotate * 3, opacity: [1, 1, 0] }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], times: [0, 0.35, 1] }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
