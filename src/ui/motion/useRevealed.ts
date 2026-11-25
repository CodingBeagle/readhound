import { useEffect, useState, type RefObject } from 'react'

const canObserve = typeof IntersectionObserver === 'function' && import.meta.env.MODE !== 'test'

/** True once the element has scrolled into view (always true where it can't be observed). */
export function useRevealed(ref: RefObject<Element | null>): boolean {
  const [revealed, setRevealed] = useState(!canObserve)
  useEffect(() => {
    const el = ref.current
    if (revealed || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, revealed])
  return revealed
}

export const motionSkipped = !canObserve
