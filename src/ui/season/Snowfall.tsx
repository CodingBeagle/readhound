import { useEffect, useRef, useState } from 'react'

import { nextShowerGap, showerIntensity, SNOW } from '@/domain/season'
import { prefersReducedMotion } from '@/ui/motion/bookAddedConfetti'

import { onLetItSnow } from './season'

/**
 * December snow (design doc, Seasonal): every few minutes a short, gentle
 * shower drifts down over the app. Flakes are drawn on one canvas that takes
 * no taps, sized for the screen, tinted for the theme (`--snow`,
 * `--snow-glow`), and left out entirely with reduced motion.
 */
export function Snowfall() {
  // Each shower gets its own canvas; a shower asked for while one is falling just lets that one finish.
  const [shower, setShower] = useState(0)
  const count = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const start = () => setShower((current) => current || ++count.current)
    let timer: ReturnType<typeof setTimeout>
    const schedule = (ms: number) => {
      timer = setTimeout(() => {
        start()
        schedule(SNOW.showerMs + nextShowerGap(Math.random()))
      }, ms)
    }
    schedule(SNOW.firstDelayMs)
    const off = onLetItSnow(start)
    return () => {
      clearTimeout(timer)
      off()
    }
  }, [])

  if (!shower) return null
  return <SnowCanvas key={shower} onDone={() => setShower(0)} />
}

type Flake = {
  x: number
  y: number
  /** Radius in CSS pixels. */
  r: number
  vy: number
  sway: number
  swaySpeed: number
  phase: number
  alpha: number
  spin: number
  angle: number
  crystal: boolean
}

const SPRITE = 64

function SnowCanvas({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      done.current()
      return
    }
    const style = getComputedStyle(canvas)
    const color = style.getPropertyValue('--snow').trim() || '#fff'
    const glow = style.getPropertyValue('--snow-glow').trim() || 'rgb(0 0 0 / 30%)'
    const dot = makeSprite(color, glow, false)
    const star = makeSprite(color, glow, true)

    let width = 0
    let height = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // A phone gets about 60 flakes at the peak, a wide screen up to 140.
    const peak = () => Math.min(140, Math.max(40, (width * height) / 6500))
    const flakes: Flake[] = []
    const spawn = (anywhere: boolean): Flake => {
      const depth = Math.random()
      const r = 1.2 + depth * depth * 3.6
      return {
        x: Math.random() * (width + 80) - 40,
        y: anywhere ? Math.random() * height * 0.3 - 20 : -10 - Math.random() * 30,
        r,
        vy: 26 + depth * 58 + Math.random() * 10,
        sway: 6 + Math.random() * 22,
        swaySpeed: 0.6 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.55 + depth * 0.45,
        spin: (Math.random() - 0.5) * 1.6,
        angle: Math.random() * Math.PI,
        crystal: r > 3 && Math.random() < 0.45,
      }
    }

    const start = performance.now()
    let last = start
    let owed = 0
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now - start
      // Keep the number of flakes on screen following the shower's intensity.
      const target = peak() * showerIntensity(t)
      owed += Math.max(0, target - flakes.length) * dt * 1.6
      while (owed >= 1) {
        flakes.push(spawn(false))
        owed -= 1
      }
      const wind = Math.sin(t / 4200) * 14 + Math.sin(t / 1700) * 5

      ctx.clearRect(0, 0, width, height)
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i]!
        f.phase += f.swaySpeed * dt
        f.angle += f.spin * dt
        f.y += f.vy * dt
        f.x += (wind * (0.4 + f.r / 5) + Math.cos(f.phase) * f.sway) * dt
        if (f.y - f.r > height + 4) {
          flakes.splice(i, 1)
          continue
        }
        const size = f.r * (f.crystal ? 3.6 : 2.6)
        ctx.globalAlpha = f.alpha
        if (f.crystal) {
          ctx.save()
          ctx.translate(f.x, f.y)
          ctx.rotate(f.angle)
          ctx.drawImage(star, -size / 2, -size / 2, size, size)
          ctx.restore()
        } else {
          ctx.drawImage(dot, f.x - size / 2, f.y - size / 2, size, size)
        }
      }
      ctx.globalAlpha = 1
      if (t > SNOW.showerMs && flakes.length === 0) {
        done.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="snowfall pointer-events-none fixed inset-0 z-40 size-full" data-testid="snowfall" />
}

/** A flake drawn once, with its soft glow, and stamped many times. */
function makeSprite(color: string, glow: string, crystal: boolean): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = SPRITE
  const g = sprite.getContext('2d')
  if (!g) return sprite
  const c = SPRITE / 2
  g.shadowColor = glow
  g.shadowBlur = SPRITE * 0.16
  if (crystal) {
    g.strokeStyle = color
    g.lineCap = 'round'
    g.lineWidth = SPRITE * 0.06
    const arm = SPRITE * 0.32
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3
      const ax = Math.cos(a)
      const ay = Math.sin(a)
      g.beginPath()
      g.moveTo(c, c)
      g.lineTo(c + ax * arm, c + ay * arm)
      // Two little branches on each arm.
      const bx = c + ax * arm * 0.58
      const by = c + ay * arm * 0.58
      for (const side of [-1, 1]) {
        const b = a + (side * Math.PI) / 4
        g.moveTo(bx, by)
        g.lineTo(bx + Math.cos(b) * arm * 0.32, by + Math.sin(b) * arm * 0.32)
      }
      g.stroke()
    }
  } else {
    const fill = g.createRadialGradient(c, c, 0, c, c, SPRITE * 0.3)
    fill.addColorStop(0, color)
    fill.addColorStop(0.7, color)
    fill.addColorStop(1, 'transparent')
    g.fillStyle = fill
    g.beginPath()
    g.arc(c, c, SPRITE * 0.3, 0, Math.PI * 2)
    g.fill()
  }
  return sprite
}
