import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'

/** Leading number of a formatted value like "5,455", "16.6" or "5 days". */
const NUMBER = /^(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?/

const skipMotion = import.meta.env.MODE === 'test'

/** A formatted number that counts up when it first appears and glides to new values after that. */
export function CountUp({ value }: { value: string }) {
  const match = NUMBER.exec(value)
  if (!match) return <>{value}</>
  return <Counter target={Number(`${match[1]!.replaceAll(',', '')}${match[2] ?? ''}`)} decimals={match[2] ? match[2].length - 1 : 0} rest={value.slice(match[0].length)} />
}

function Counter({ target, decimals, rest }: { target: number; decimals: number; rest: string }) {
  const reduce = useReducedMotion()
  const still = skipMotion || !!reduce
  const count = useMotionValue(still ? target : 0)
  const text = useTransform(count, (n) => n.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + rest)

  useEffect(() => {
    if (still) {
      count.set(target)
      return
    }
    const controls = animate(count, target, { duration: Math.min(1.4, 0.6 + Math.log10(target + 1) * 0.2), ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [count, target, still])

  return <motion.span>{text}</motion.span>
}
