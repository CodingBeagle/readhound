import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { t } from '@/i18n'
import * as bark from '@/ui/motion/bookAddedBark'

import { BARK_MS, BarkingBeagle, STILL_MS, WALK_IN_MS, WALK_OUT_MS } from './BarkingBeagle'

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }))
}

let playBark: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  playBark = vi.spyOn(bark, 'playBark').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const phase = () => screen.getByTestId('barking-beagle').querySelector('[data-phase]')?.getAttribute('data-phase')

describe('BarkingBeagle', () => {
  it('trots in, barks with a Woof! bubble and trots off', () => {
    setReducedMotion(false)
    render(<BarkingBeagle />)
    expect(screen.queryByTestId('barking-beagle')).toBeNull()

    act(() => bark.announceBookAdded())
    expect(phase()).toBe('in')
    expect(screen.queryByText(t.bark.woof)).toBeNull()

    act(() => vi.advanceTimersByTime(WALK_IN_MS))
    expect(phase()).toBe('bark')
    expect(screen.getByText(t.bark.woof)).toBeInTheDocument()
    expect(playBark).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(BARK_MS))
    expect(phase()).toBe('out')
    act(() => vi.advanceTimersByTime(WALK_OUT_MS))
    expect(screen.queryByTestId('barking-beagle')).toBeNull()
  })

  it('restarts instead of stacking barks when books arrive in quick succession', () => {
    setReducedMotion(false)
    render(<BarkingBeagle />)
    act(() => bark.announceBookAdded())
    act(() => vi.advanceTimersByTime(WALK_IN_MS / 2))
    act(() => bark.announceBookAdded())
    act(() => vi.advanceTimersByTime(WALK_IN_MS / 2))
    expect(playBark).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(WALK_IN_MS))
    expect(playBark).toHaveBeenCalledTimes(1)
  })

  it('just appears and barks when the reader prefers reduced motion', () => {
    setReducedMotion(true)
    render(<BarkingBeagle />)
    act(() => bark.announceBookAdded())
    expect(phase()).toBe('bark')
    expect(screen.getByText(t.bark.woof)).toBeInTheDocument()
    expect(screen.getByTestId('barking-beagle').querySelector('.barker-still')).not.toBeNull()
    expect(playBark).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(STILL_MS))
    expect(screen.queryByTestId('barking-beagle')).toBeNull()
  })
})
