import 'fake-indexeddb/auto'

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'motion/react'
import { MemoryRouter } from 'react-router'

import { createServices, ServicesProvider, type Services } from '@/app/services'
import { ReadhoundDB } from '@/db/schema'
import { SETTING_BUDDY_QUOTES } from '@/domain/quotes'
import { t } from '@/i18n'

import { BeagleBuddy, CHATTER_MS, QUOTE_MS, SETTING_BUDDY_INTRODUCED } from './BeagleBuddy'

// Fake timers move the clock that animations run on; skip them so speech bubbles swap at once.
MotionGlobalConfig.skipAnimations = true

const q = t.buddy.quotes
let services: Services

/** A fixed day: 2 March 2026 opens with a quote, 3 March with the buddy's own line. */
function servicesOn(date: string) {
  const db = new ReadhoundDB(`buddy-${crypto.randomUUID()}`)
  services = createServices(db, { now: () => new Date(`${date}T12:00:00Z`), timeZone: () => 'UTC' })
  return services
}

afterEach(async () => {
  vi.useRealTimers()
  await services.db.delete()
})

/** Renders the buddy; by default Zico has already said hello, so his usual lines show. */
async function renderBuddy({ introduced = true } = {}) {
  if (introduced) await services.db.settings.put({ key: SETTING_BUDDY_INTRODUCED, value: true })
  render(
    <ServicesProvider services={services} demoDbName={`buddy-demo-${crypto.randomUUID()}`}>
      <MemoryRouter>
        <BeagleBuddy />
      </MemoryRouter>
    </ServicesProvider>,
  )
  return screen.findByRole('region', { name: t.buddy.label })
}

const shownQuote = (buddy: HTMLElement) => within(buddy).queryByTestId('buddy-quote')?.getAttribute('data-quote')

describe('BeagleBuddy quotes', () => {
  it('shares a quote with the book and author, and another one on a tap', async () => {
    servicesOn('2026-03-02')
    const user = userEvent.setup()
    const buddy = await renderBuddy()
    const quote = await within(buddy).findByTestId('buddy-quote')
    expect(within(quote).getByRole('status')).toHaveTextContent(/—\s.+, .+/)
    expect(within(quote).getByRole('link', { name: q.find })).toHaveAttribute('href', expect.stringMatching(/^\/search\?q=/))

    const first = shownQuote(buddy)
    await user.click(within(buddy).getByRole('button', { name: /^Zico/ }))
    await waitFor(() => expect(shownQuote(buddy)).not.toBe(first))
    const second = shownQuote(buddy)
    await user.click(within(buddy).getByRole('button', { name: q.another }))
    await waitFor(() => expect(shownQuote(buddy)).not.toBe(second))
  })

  it('sticks to the favourite themes', async () => {
    servicesOn('2026-03-02')
    await services.db.settings.put({ key: SETTING_BUDDY_QUOTES, value: { enabled: true, themes: ['grief'] } })
    const buddy = await renderBuddy()
    expect(await within(buddy).findByText(q.label(t.quoteThemes.grief))).toBeInTheDocument()
  })

  it('takes turns with its own lines', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    servicesOn('2026-03-03')
    const buddy = await renderBuddy()
    await waitFor(() => expect(within(buddy).getByRole('status')).toHaveTextContent(/first book|empty shelf/))
    expect(shownQuote(buddy)).toBeUndefined()
    await act(() => vi.advanceTimersByTimeAsync(CHATTER_MS))
    await waitFor(() => expect(shownQuote(buddy)).toBeTruthy())
    await act(() => vi.advanceTimersByTimeAsync(QUOTE_MS))
    await waitFor(() => expect(shownQuote(buddy)).toBeUndefined())
  })

  it('keeps quiet about books when quotes are off', async () => {
    servicesOn('2026-03-02')
    await services.db.settings.put({ key: SETTING_BUDDY_QUOTES, value: { enabled: false, themes: [] } })
    const buddy = await renderBuddy()
    await waitFor(() => expect(within(buddy).getByRole('status')).toHaveTextContent(/first book|empty shelf/))
    expect(shownQuote(buddy)).toBeUndefined()
  })
})

describe('Zico says hello', () => {
  it('introduces himself by name the first time, then moves on to his usual lines', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    servicesOn('2026-03-03')
    await services.db.settings.put({ key: SETTING_BUDDY_QUOTES, value: { enabled: false, themes: [] } })
    const buddy = await renderBuddy({ introduced: false })
    expect(within(buddy).getByTestId('buddy-name-tag')).toHaveTextContent(t.mascot)
    await waitFor(() => expect(within(buddy).getByRole('status')).toHaveTextContent(/I’m Zico/))
    await waitFor(async () => expect((await services.db.settings.get(SETTING_BUDDY_INTRODUCED))?.value).toBe(true))
    await act(() => vi.advanceTimersByTimeAsync(CHATTER_MS))
    await waitFor(() => expect(within(buddy).getByRole('status')).toHaveTextContent(/first book|empty shelf/))
  })

  it('stops the greeting on a tap', async () => {
    servicesOn('2026-03-03')
    await services.db.settings.put({ key: SETTING_BUDDY_QUOTES, value: { enabled: false, themes: [] } })
    const user = userEvent.setup()
    const buddy = await renderBuddy({ introduced: false })
    await waitFor(() => expect(within(buddy).getByRole('status')).toHaveTextContent(/I’m Zico/))
    await user.click(within(buddy).getByRole('button', { name: /^Zico/ }))
    await waitFor(() => expect(within(buddy).getByRole('status')).not.toHaveTextContent(/I’m Zico/))
  })
})
