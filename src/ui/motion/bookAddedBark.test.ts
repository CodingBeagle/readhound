import { afterEach, describe, expect, it, vi } from 'vitest'

import { BARK_SOUND_KEY, BARK_VOLUME, barkSoundEnabled, celebrateNewBook, onBookAdded, playBark, saveBarkSound } from './bookAddedBark'

/** A stand-in AudioContext that records the sounds it is asked to make. */
function fakeAudio() {
  const started: number[] = []
  const peaks: number[] = []
  const param = (record = false) => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn((v: number) => record && peaks.push(v)) })
  const node = () => ({ connect: vi.fn((next: unknown) => next), gain: param(true), frequency: param(), Q: param() })
  class FakeContext {
    state = 'running'
    currentTime = 0
    sampleRate = 8000
    destination = {}
    resume = vi.fn(async () => {})
    createGain = node
    createBiquadFilter = node
    createOscillator = () => ({ ...node(), type: '', start: (at: number) => started.push(at), stop: vi.fn() })
    createBuffer = (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) })
    createBufferSource = () => ({ ...node(), buffer: null, start: vi.fn() })
  }
  vi.stubGlobal('AudioContext', FakeContext)
  return { started, peaks }
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('bark sound setting', () => {
  it('is on by default and remembered per device', () => {
    expect(barkSoundEnabled()).toBe(true)
    saveBarkSound(false)
    expect(localStorage.getItem(BARK_SOUND_KEY)).toBe('off')
    expect(barkSoundEnabled()).toBe(false)
    saveBarkSound(true)
    expect(barkSoundEnabled()).toBe(true)
  })
})

describe('playBark', () => {
  // The module keeps one AudioContext, so the first test that plays creates it from the fake.
  it('barks twice, quietly, when sound is on', () => {
    const audio = fakeAudio()
    playBark()
    expect(audio.started).toHaveLength(2)
    expect(Math.max(...audio.peaks)).toBeLessThanOrEqual(BARK_VOLUME)
  })

  it('stays silent when the reader turned it off', () => {
    const audio = fakeAudio()
    saveBarkSound(false)
    playBark()
    expect(audio.started).toHaveLength(0)
  })
})

describe('celebrateNewBook', () => {
  it('announces the book to the beagle', () => {
    const listener = vi.fn()
    const off = onBookAdded(listener)
    celebrateNewBook()
    off()
    celebrateNewBook()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
