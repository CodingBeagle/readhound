import 'fake-indexeddb/auto'

import { parseBackup } from '@/db/backup'
import type { Clock } from '@/db/clock'
import { loadLibrary } from '@/db/queries'
import { ReadhoundDB } from '@/db/schema'
import { validateSession } from '@/domain/sessions'

import { buildSampleLibrary } from './sampleLibrary'
import { seedDemo } from './seed'

describe.each(['2026-11-25', '2026-12-24', '2027-01-01', '2027-08-15'])('sample library for %s', (today) => {
  const data = buildSampleLibrary({ today })

  it('is the same every time for the same day', () => {
    expect(buildSampleLibrary({ today })).toEqual(data)
  })

  it('covers every status, rereads, DNFs with a stop page, and about two years of sessions', () => {
    const count = (s: string) => data.entries.filter((e) => e.status === s).length
    expect(count('reading')).toBeGreaterThanOrEqual(1)
    expect(count('finished')).toBeGreaterThanOrEqual(25)
    expect(count('dnf')).toBeGreaterThanOrEqual(2)
    expect(count('to_read')).toBeGreaterThanOrEqual(2)
    expect(data.reads.filter((r) => r.outcome === 'dnf').every((r) => r.stoppedAtPage !== undefined)).toBe(true)
    const finishedPerEntry = new Map<string, number>()
    for (const r of data.reads) if (r.outcome === 'finished') finishedPerEntry.set(r.entryId, (finishedPerEntry.get(r.entryId) ?? 0) + 1)
    expect([...finishedPerEntry.values()].filter((n) => n > 1).length).toBeGreaterThanOrEqual(1)
    const dates = data.sessions.map((s) => s.startedAt.slice(0, 10)).sort()
    expect(dates[0]! < `${Number(today.slice(0, 4)) - 1}`).toBe(true)
    expect(dates.at(-1)! <= today).toBe(true)
    expect(new Set(data.editions.map((e) => e.language))).toEqual(new Set(['dan', 'eng']))
  })

  it('keeps reads and sessions consistent with the app’s own rules', () => {
    for (const entry of data.entries) {
      const reads = data.reads.filter((r) => r.entryId === entry.id).sort((a, b) => a.startedOn.localeCompare(b.startedOn))
      expect(reads.filter((r) => r.outcome === undefined).length).toBeLessThanOrEqual(1)
      if (entry.status === 'reading') expect(reads.at(-1)?.outcome).toBeUndefined()
      if (entry.status === 'finished' || entry.status === 'dnf') expect(reads.at(-1)?.outcome).toBe(entry.status)
      if (entry.status === 'to_read') expect(reads).toEqual([])
      const pageCount = data.editions.find((e) => e.id === entry.editionId)!.pageCount
      for (const read of reads) {
        if (read.endedOn) expect(read.endedOn >= read.startedOn).toBe(true)
        const sessions = data.sessions.filter((s) => s.readId === read.id).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        for (const [i, s] of sessions.entries()) {
          expect(validateSession(s, pageCount, sessions[i - 1])).toBeNull()
          if (i > 0) expect(s.fromPage).toBe(sessions[i - 1]!.toPage)
          expect(s.pagesRead).toBe(s.toPage - s.fromPage)
        }
        if (read.outcome === 'finished' && sessions.length) expect(sessions.at(-1)!.toPage).toBe(pageCount)
      }
    }
  })
})

it('passes the backup file checks', () => {
  const data = buildSampleLibrary({ today: '2026-11-25' })
  expect(() => parseBackup(JSON.stringify({ format: 'readhound-backup', version: 1, appVersion: 'x', exportedAt: 'y', data }))).not.toThrow()
})

it('seeds only the demo database', async () => {
  const clock: Clock = { now: () => new Date('2026-11-25T09:00:00Z'), timeZone: () => 'Europe/Copenhagen' }
  await expect(seedDemo(new ReadhoundDB('readhound'), clock)).rejects.toThrow('demo database')
  const db = new ReadhoundDB(`test-${crypto.randomUUID()}`)
  await seedDemo(db, clock)
  const books = await loadLibrary(db)
  expect(books.length).toBeGreaterThan(30)
  await db.delete()
})
