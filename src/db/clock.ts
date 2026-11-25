import { deviceTimeZone, localDate } from '@/domain/dates'

/** Time source for repositories, injectable for tests. */
export interface Clock {
  now(): Date
  timeZone(): string
}

export const systemClock: Clock = {
  now: () => new Date(),
  timeZone: deviceTimeZone,
}

export const today = (clock: Clock) => localDate(clock.now(), clock.timeZone())

export const newId = () => crypto.randomUUID()
