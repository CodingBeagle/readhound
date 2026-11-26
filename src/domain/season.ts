import { localDate } from './dates'

/**
 * December Easter egg (design doc, Seasonal): for the whole of December, in
 * the device's local time, Zico wears a Santa hat and snow falls now and then.
 */

/** Demo-database-only setting that forces December mode on, for trying it out. */
export const SETTING_DEMO_DECEMBER = 'demoDecember'

/** True when the instant falls in December in the given time zone. */
export function isDecember(instant: Date, timeZone?: string): boolean {
  return localDate(instant, timeZone).slice(5, 7) === '12'
}

/** Milliseconds until the local month may have changed: the next local midnight, at most an hour away. */
export function msUntilRecheck(instant: Date): number {
  const next = new Date(instant)
  next.setHours(24, 0, 5, 0)
  return Math.min(next.getTime() - instant.getTime(), 60 * 60 * 1000)
}

/** Snow showers: the first soon after opening the app, then one every few minutes. */
export const SNOW = {
  firstDelayMs: 2500,
  /** Pause between showers, picked at random in this range. */
  gapMs: [3 * 60 * 1000, 6 * 60 * 1000] as const,
  /** How long new flakes keep coming in one shower; the last ones still drift down after. */
  showerMs: 14000,
} as const

/** The pause before the next shower, given a random number in [0, 1). */
export function nextShowerGap(random: number): number {
  const [min, max] = SNOW.gapMs
  return Math.round(min + (max - min) * random)
}

/**
 * How many flakes should be falling `t` ms into a shower, as a share of the
 * peak: it eases in, holds and tapers off so a shower never starts or stops abruptly.
 */
export function showerIntensity(t: number, duration: number = SNOW.showerMs): number {
  if (t <= 0 || t >= duration) return 0
  const ramp = duration * 0.22
  if (t < ramp) return easeInOut(t / ramp)
  if (t > duration - ramp) return easeInOut((duration - t) / ramp)
  return 1
}

const easeInOut = (x: number) => (1 - Math.cos(Math.PI * x)) / 2

/**
 * Bedtime Easter egg (design doc, Seasonal): from 18:00 until 06:00 in the
 * device's local time Zico wears his pyjamas and a nightcap.
 */
export const BEDTIME = { startHour: 18, endHour: 6 } as const

/** Demo-database-only setting that forces pyjama time on, for trying it out. */
export const SETTING_DEMO_PYJAMAS = 'demoPyjamas'

/** Seconds since local midnight for an instant in a time zone (default: the device's). */
function localSecondOfDay(instant: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 3600 + get('minute') * 60 + get('second')
}

/** True from 18:00 up to (not including) 06:00 local time. */
export function isBedtime(instant: Date, timeZone?: string): boolean {
  const hour = Math.floor(localSecondOfDay(instant, timeZone) / 3600)
  return hour >= BEDTIME.startHour || hour < BEDTIME.endHour
}

/**
 * Milliseconds until the next 06:00 or 18:00 local time, plus a moment so the
 * check lands just after it. Never more than an hour, so a daylight saving
 * change or a sleeping device can only delay the switch, not lose it.
 */
export function msUntilBedtimeChange(instant: Date, timeZone?: string): number {
  const now = localSecondOfDay(instant, timeZone) + (instant.getMilliseconds() / 1000)
  const marks = [BEDTIME.endHour * 3600, BEDTIME.startHour * 3600, 24 * 3600 + BEDTIME.endHour * 3600]
  const next = marks.find((m) => m > now)!
  return Math.min(Math.round((next - now) * 1000) + 1000, 60 * 60 * 1000)
}
