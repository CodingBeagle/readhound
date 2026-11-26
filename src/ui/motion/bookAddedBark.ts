/**
 * The beagle that trots in and barks when a new book lands in the library
 * (design doc, Animation). Add screens call `celebrateNewBook()`, which fires
 * the confetti splash and announces the book; `<BarkingBeagle>` in the app
 * shell listens and plays the walk-on. Nothing here blocks: callers navigate
 * straight on.
 *
 * Only single books the reader adds by hand count. A bulk import (Goodreads,
 * a backup restore) must not call `celebrateNewBook()` per book; it may call
 * it once for the whole import. Announcements that arrive while the beagle is
 * already on screen restart its walk instead of stacking up barks.
 */
import { celebrateBookAdded } from './bookAddedConfetti'

export const BOOK_ADDED_EVENT = 'readhound:book-added'

/** Confetti plus the barking beagle, for one book the reader just added. */
export function celebrateNewBook(): void {
  void celebrateBookAdded()
  announceBookAdded()
}

export function announceBookAdded(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(BOOK_ADDED_EVENT))
}

export function onBookAdded(listener: () => void): () => void {
  window.addEventListener(BOOK_ADDED_EVENT, listener)
  return () => window.removeEventListener(BOOK_ADDED_EVENT, listener)
}

// ── The sound setting: a per-device preference like the theme (Profile > Sounds). ──

export const BARK_SOUND_KEY = 'readhound.barkSound'

/** On unless the reader turned it off on this device. */
export function readBarkSound(): boolean {
  try {
    return localStorage.getItem(BARK_SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

const listeners = new Set<() => void>()
/** Fallback when localStorage is blocked, so the toggle still works for this visit. */
let memory: boolean | undefined

export function saveBarkSound(on: boolean): void {
  try {
    localStorage.setItem(BARK_SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Blocked storage: the choice holds until the page reloads.
    memory = on
  }
  listeners.forEach((l) => l())
}

export function barkSoundEnabled(): boolean {
  return memory ?? readBarkSound()
}

export function subscribeBarkSound(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ── The bark itself: synthesised with Web Audio, so there is no sound file to ship. ──

/** Peak loudness of the bark (0–1): quiet enough not to startle in a quiet room. */
export const BARK_VOLUME = 0.16

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

let context: AudioContext | undefined

function audioContext(): AudioContext | undefined {
  if (context) return context
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined
  if (!Ctor) return undefined
  // Safari 17+: an ambient session follows the ring/silent switch and mixes with the reader's music.
  const nav = navigator as AudioSessionNavigator
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'ambient'
    } catch {
      // Older engines refuse the type; Web Audio still respects the silent switch there.
    }
  }
  try {
    context = new Ctor()
  } catch {
    return undefined
  }
  return context
}

/**
 * Wakes the audio context during a tap, because some browsers only let sound
 * start from a user gesture and the bark comes a moment after the Add tap.
 */
export function primeBarkAudio(): void {
  const ctx = audioContext()
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined)
}

/** One "woof": a pitch drop through a throaty filter, with a puff of breath. */
function woof(ctx: AudioContext, at: number, pitch: number) {
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, at)
  out.gain.exponentialRampToValueAtTime(BARK_VOLUME, at + 0.012)
  out.gain.exponentialRampToValueAtTime(BARK_VOLUME * 0.45, at + 0.07)
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.19)
  out.connect(ctx.destination)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(2200, at)
  filter.frequency.exponentialRampToValueAtTime(700, at + 0.17)
  filter.connect(out)

  const voice = ctx.createOscillator()
  voice.type = 'sawtooth'
  voice.frequency.setValueAtTime(pitch * 0.8, at)
  voice.frequency.exponentialRampToValueAtTime(pitch, at + 0.025)
  voice.frequency.exponentialRampToValueAtTime(pitch * 0.42, at + 0.18)
  voice.connect(filter)
  voice.start(at)
  voice.stop(at + 0.2)

  const length = Math.floor(ctx.sampleRate * 0.08)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  const breath = ctx.createBufferSource()
  breath.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1500
  band.Q.value = 1.2
  const breathGain = ctx.createGain()
  breathGain.gain.value = 0.5
  breath.connect(band).connect(breathGain).connect(out)
  breath.start(at)
}

/** Two short barks, unless the reader turned the sound off. Never throws. */
export function playBark(): void {
  if (!barkSoundEnabled()) return
  try {
    const ctx = audioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    const now = ctx.currentTime + 0.02
    woof(ctx, now, 560)
    woof(ctx, now + 0.24, 620)
  } catch {
    // No audio device or a blocked context: the beagle barks silently.
  }
}
