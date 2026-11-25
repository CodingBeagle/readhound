/** The device's IANA time zone, e.g. "Europe/Copenhagen". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** `YYYY-MM-DD` for an instant in a time zone (default: the device's). */
export function localDate(instant: Date, timeZone: string = deviceTimeZone()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    instant,
  )
}
