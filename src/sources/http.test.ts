import { HttpClient, HttpError, MemoryCache } from './http'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** A fake clock: sleeps resolve at once and are recorded; time moves only on `advance`. */
function fakeClock() {
  let time = 0
  const sleeps: number[] = []
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms)
    },
    advance: (ms: number) => {
      time += ms
    },
    sleeps,
  }
}

describe('HttpClient', () => {
  it('returns parsed JSON and null on 404', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      String(url).endsWith('/missing') ? json({}, 404) : json({ ok: 1 }),
    )
    const http = new HttpClient({ fetch, ...fakeClock() })
    expect(await http.getJson('https://x.test/a')).toEqual({ ok: 1 })
    expect(await http.getJson('https://x.test/missing')).toBeNull()
  })

  it('throws HttpError on other failures', async () => {
    const http = new HttpClient({ fetch: async () => json({}, 500), ...fakeClock() })
    await expect(http.getJson('https://x.test/a')).rejects.toBeInstanceOf(HttpError)
  })

  it('spaces requests to at most 3 per second', async () => {
    const clock = fakeClock()
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({}))
    const http = new HttpClient({ fetch, ...clock })
    await Promise.all([1, 2, 3, 4].map((i) => http.getJson(`https://x.test/${i}`)))
    // Four requests at once: the first goes now, the others wait for their slot.
    expect(clock.sleeps.map(Math.round)).toEqual([333, 667, 1000])
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('waits 1 second and retries once on HTTP 429', async () => {
    const clock = fakeClock()
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ ok: 1 }))
    const http = new HttpClient({ fetch, ...clock })
    expect(await http.getJson('https://x.test/a')).toEqual({ ok: 1 })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(clock.sleeps).toContain(1000)
  })

  it('retries once on a dropped connection, then gives up', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const http = new HttpClient({ fetch, ...fakeClock() })
    await expect(http.getJson('https://x.test/a')).rejects.toBeInstanceOf(TypeError)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry an aborted request', async () => {
    const controller = new AbortController()
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      controller.abort()
      throw new DOMException('Aborted', 'AbortError')
    })
    const http = new HttpClient({ fetch, ...fakeClock() })
    await expect(http.getJson('https://x.test/a', { signal: controller.signal })).rejects.toThrow('Aborted')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('passes a timeout signal to every request', async () => {
    let signal: AbortSignal | null | undefined
    const http = new HttpClient({
      fetch: async (_url, init) => {
        signal = init?.signal
        return json({})
      },
      ...fakeClock(),
    })
    await http.getJson('https://x.test/a')
    expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('serves cached responses until the TTL runs out', async () => {
    const clock = fakeClock()
    let n = 0
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ n: ++n }))
    const http = new HttpClient({ fetch, cache: new MemoryCache(), ...clock })

    expect(await http.getJson('https://x.test/a', { cacheTtlMs: 1000 })).toEqual({ n: 1 })
    expect(await http.getJson('https://x.test/a', { cacheTtlMs: 1000 })).toEqual({ n: 1 })
    clock.advance(1000)
    expect(await http.getJson('https://x.test/a', { cacheTtlMs: 1000 })).toEqual({ n: 2 })
    expect(await http.getJson('https://x.test/a')).toEqual({ n: 3 }) // no TTL → no cache
  })

  it('sends configured headers', async () => {
    let headers: HeadersInit | undefined
    const http = new HttpClient({
      fetch: async (_url, init) => {
        headers = init?.headers
        return json({})
      },
      headers: { 'User-Agent': 'Readhound/0.1.0' },
      ...fakeClock(),
    })
    await http.getJson('https://x.test/a')
    expect(headers).toMatchObject({ 'User-Agent': 'Readhound/0.1.0', Accept: 'application/json' })
  })
})
