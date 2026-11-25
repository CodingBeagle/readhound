/**
 * A small JSON HTTP client for catalog APIs: client-side throttling, a
 * per-request timeout, one retry on HTTP 429 or a dropped connection, and a
 * URL-keyed response cache with a time-to-live per call.
 */

export interface CacheEntry {
  value: unknown
  storedAt: number
}

/** Storage for cached responses. In memory now; the database PR can add an IndexedDB-backed one. */
export interface ResponseCache {
  get(key: string): Promise<CacheEntry | undefined>
  set(key: string, entry: CacheEntry): Promise<void>
}

export class MemoryCache implements ResponseCache {
  private readonly map = new Map<string, CacheEntry>()
  async get(key: string) {
    return this.map.get(key)
  }
  async set(key: string, entry: CacheEntry) {
    this.map.set(key, entry)
  }
}

export class HttpError extends Error {
  readonly status: number
  readonly url: string
  constructor(status: number, url: string) {
    super(`Request to ${url} failed with HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
  }
}

export interface HttpClientOptions {
  fetch?: typeof fetch
  cache?: ResponseCache
  /** At most this many request starts per second. */
  maxRequestsPerSecond?: number
  timeoutMs?: number
  retryDelayMs?: number
  /** Extra request headers, e.g. a User-Agent where the platform allows setting one. */
  headers?: Record<string, string>
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface GetJsonOptions {
  /** How long a cached response stays fresh. Omit to skip the cache. */
  cacheTtlMs?: number
  signal?: AbortSignal
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class HttpClient {
  private readonly fetchImpl: typeof fetch
  private readonly cache: ResponseCache
  private readonly minIntervalMs: number
  private readonly timeoutMs: number
  private readonly retryDelayMs: number
  private readonly headers: Record<string, string>
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private nextSlot = 0

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args))
    this.cache = options.cache ?? new MemoryCache()
    this.minIntervalMs = 1000 / (options.maxRequestsPerSecond ?? 3)
    this.timeoutMs = options.timeoutMs ?? 15_000
    this.retryDelayMs = options.retryDelayMs ?? 1_000
    this.headers = options.headers ?? {}
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? defaultSleep
  }

  /** GETs JSON. Resolves to null on HTTP 404; throws HttpError on other failures. */
  async getJson<T>(url: string, options: GetJsonOptions = {}): Promise<T | null> {
    const { cacheTtlMs, signal } = options
    if (cacheTtlMs !== undefined) {
      const hit = await this.cache.get(url)
      if (hit && this.now() - hit.storedAt < cacheTtlMs) return hit.value as T | null
    }

    let response: Response
    try {
      response = await this.request(url, signal)
      if (response.status === 429) {
        await this.sleep(this.retryDelayMs)
        response = await this.request(url, signal)
      }
    } catch (error) {
      if (!isDroppedConnection(error)) throw error
      await this.sleep(this.retryDelayMs)
      response = await this.request(url, signal)
    }

    let value: T | null
    if (response.status === 404) value = null
    else if (!response.ok) throw new HttpError(response.status, url)
    else value = (await response.json()) as T

    if (cacheTtlMs !== undefined) await this.cache.set(url, { value, storedAt: this.now() })
    return value
  }

  private async request(url: string, signal?: AbortSignal): Promise<Response> {
    await this.throttle(signal)
    const timeout = AbortSignal.timeout(this.timeoutMs)
    return this.fetchImpl(url, {
      headers: { Accept: 'application/json', ...this.headers },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  }

  /** Spaces request starts at least `minIntervalMs` apart. */
  private async throttle(signal?: AbortSignal) {
    const now = this.now()
    const slot = Math.max(now, this.nextSlot)
    this.nextSlot = slot + this.minIntervalMs
    if (slot > now) await this.sleep(slot - now)
    signal?.throwIfAborted()
  }
}

/** fetch rejects with a TypeError when the connection fails or drops; aborts and timeouts are DOMExceptions. */
function isDroppedConnection(error: unknown): boolean {
  return error instanceof TypeError
}
