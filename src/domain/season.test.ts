import { describe, expect, it } from 'vitest'

import { isBedtime, isDecember, msUntilBedtimeChange, msUntilRecheck, nextShowerGap, showerIntensity, SNOW } from './season'

describe('isDecember', () => {
  it('is true for every day of December in local time', () => {
    expect(isDecember(new Date('2026-12-01T00:30:00+01:00'), 'Europe/Copenhagen')).toBe(true)
    expect(isDecember(new Date('2026-12-15T12:00:00Z'), 'Europe/Copenhagen')).toBe(true)
    expect(isDecember(new Date('2026-12-31T23:30:00+01:00'), 'Europe/Copenhagen')).toBe(true)
  })

  it('is false in November and January, by the local calendar', () => {
    // 23:30 UTC on 30 November is already 1 December in Copenhagen, but not in New York.
    const instant = new Date('2026-11-30T23:30:00Z')
    expect(isDecember(instant, 'Europe/Copenhagen')).toBe(true)
    expect(isDecember(instant, 'America/New_York')).toBe(false)
    expect(isDecember(new Date('2027-01-01T00:30:00+01:00'), 'Europe/Copenhagen')).toBe(false)
    expect(isDecember(new Date('2026-11-26T12:00:00Z'), 'Europe/Copenhagen')).toBe(false)
  })
})

describe('msUntilRecheck', () => {
  it('waits at most an hour', () => {
    expect(msUntilRecheck(new Date(2026, 10, 26, 9, 0))).toBe(60 * 60 * 1000)
    expect(msUntilRecheck(new Date(2026, 10, 30, 23, 59, 0))).toBe(65 * 1000)
  })
})

describe('snow showers', () => {
  it('spaces showers a few minutes apart', () => {
    expect(nextShowerGap(0)).toBe(SNOW.gapMs[0])
    expect(nextShowerGap(0.999999)).toBeCloseTo(SNOW.gapMs[1], -1)
  })

  it('eases in, holds and tapers off', () => {
    expect(showerIntensity(0)).toBe(0)
    expect(showerIntensity(SNOW.showerMs * 0.1)).toBeGreaterThan(0)
    expect(showerIntensity(SNOW.showerMs * 0.1)).toBeLessThan(1)
    expect(showerIntensity(SNOW.showerMs / 2)).toBe(1)
    expect(showerIntensity(SNOW.showerMs * 0.95)).toBeLessThan(0.3)
    expect(showerIntensity(SNOW.showerMs)).toBe(0)
  })
})

describe('isBedtime', () => {
  const at = (time: string) => new Date(`2026-11-26T${time}+01:00`)
  it('is pyjama time from 18:00 until 06:00 local time', () => {
    expect(isBedtime(at('17:59:59'), 'Europe/Copenhagen')).toBe(false)
    expect(isBedtime(at('18:00:00'), 'Europe/Copenhagen')).toBe(true)
    expect(isBedtime(at('23:59:00'), 'Europe/Copenhagen')).toBe(true)
    expect(isBedtime(at('00:00:00'), 'Europe/Copenhagen')).toBe(true)
    expect(isBedtime(at('05:59:59'), 'Europe/Copenhagen')).toBe(true)
    expect(isBedtime(at('06:00:00'), 'Europe/Copenhagen')).toBe(false)
    expect(isBedtime(at('12:00:00'), 'Europe/Copenhagen')).toBe(false)
  })

  it('goes by the local clock, not UTC', () => {
    // 18:30 in Copenhagen is still 12:30 in New York.
    const instant = at('18:30:00')
    expect(isBedtime(instant, 'Europe/Copenhagen')).toBe(true)
    expect(isBedtime(instant, 'America/New_York')).toBe(false)
  })
})

describe('msUntilBedtimeChange', () => {
  const at = (time: string) => new Date(`2026-11-26T${time}+01:00`)
  const tz = 'Europe/Copenhagen'
  it('wakes just after the next 18:00 or 06:00', () => {
    expect(msUntilBedtimeChange(at('17:59:00'), tz)).toBe(61 * 1000)
    expect(msUntilBedtimeChange(at('05:58:30'), tz)).toBe(91 * 1000)
    expect(msUntilBedtimeChange(at('23:30:00'), tz)).toBe(60 * 60 * 1000)
  })

  it('waits at most an hour', () => {
    expect(msUntilBedtimeChange(at('09:00:00'), tz)).toBe(60 * 60 * 1000)
    expect(msUntilBedtimeChange(at('18:00:01'), tz)).toBe(60 * 60 * 1000)
  })
})
