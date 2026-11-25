import 'fake-indexeddb/auto'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { routes } from '@/app/routes'
import { ServicesProvider, type Services } from '@/app/services'
import { LibraryRepository } from '@/db/library'
import { ReadhoundDB } from '@/db/schema'
import { t } from '@/i18n'
import { HttpClient } from '@/sources/http'
import { fixtureFetch } from '@/sources/openlibrary/fixtureFetch'
import { OpenLibrarySource } from '@/sources/openlibrary/OpenLibrarySource'
import { SourceRegistry } from '@/sources/registry'

let services: Services

beforeEach(async () => {
  const db = new ReadhoundDB(`ui-${crypto.randomUUID()}`)
  await db.open()
  const http = new HttpClient({ fetch: fixtureFetch, sleep: async () => {} })
  services = { db, library: new LibraryRepository(db), sources: new SourceRegistry([new OpenLibrarySource(http)]) }
})
afterEach(async () => {
  await services.db.delete()
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  )
  return router
}

async function addManual(title: string, author: string, status: 'to_read' | 'reading' | 'finished' | 'dnf' = 'to_read', pageCount = 300) {
  const { entryId } = await services.library.addManual({ title, authors: [author], pageCount }, { status } as never)
  return entryId
}

describe('search → edition → add', () => {
  it('finds a book, picks a Danish edition and adds it as currently reading', async () => {
    const user = userEvent.setup()
    const router = renderAt('/search')
    await user.type(screen.getByLabelText(t.screens.search.label), 'froken smilla')
    await user.click((await screen.findAllByText('Frøken Smillas fornemmelse for sne', {}, { timeout: 3000 }))[0]!)

    // Danish editions come first because Danish is a preferred language.
    await screen.findByText(t.screens.work.chooseEdition)
    const editions = await screen.findAllByRole('link', { name: /Smilla/ })
    expect(editions[0]).toHaveTextContent('DAN')
    await user.click(editions[0]!)

    await screen.findByRole('heading', { name: t.screens.add.title })
    await user.selectOptions(screen.getByLabelText(t.screens.add.status), 'reading')
    await user.click(screen.getByRole('button', { name: t.screens.add.submit }))

    await screen.findByRole('button', { name: t.statusLong.reading, pressed: true })
    expect(router.state.location.pathname).toMatch(/^\/book\//)
    expect(await services.db.entries.count()).toBe(1)
  })

  it('offers manual entry when nothing is found', async () => {
    const user = userEvent.setup()
    renderAt('/search')
    await user.type(screen.getByLabelText(t.screens.search.label), 'no such book')
    expect(await screen.findByText(t.screens.search.noResults('no such book'), {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.screens.search.addManually })).toHaveAttribute('href', '/add/manual?title=no%20such%20book')
  })
})

describe('manual entry', () => {
  it('requires a title and author and rejects a bad ISBN', async () => {
    const user = userEvent.setup()
    const router = renderAt('/add/manual?title=Min%20bog')
    expect(screen.getByLabelText(t.screens.manual.bookTitle)).toHaveValue('Min bog')
    await user.type(screen.getByLabelText(t.screens.manual.isbn), '1234567890')
    await user.click(screen.getByRole('button', { name: t.screens.add.submit }))
    expect(await screen.findByText(t.screens.manual.authorRequired)).toBeInTheDocument()
    expect(screen.getByText(t.screens.manual.invalidIsbn)).toBeInTheDocument()

    await user.type(screen.getByLabelText(t.screens.manual.authors), 'Kasper')
    await user.clear(screen.getByLabelText(t.screens.manual.isbn))
    await user.click(screen.getByRole('button', { name: t.screens.add.submit }))
    await screen.findByRole('button', { name: t.statusLong.to_read, pressed: true })
    expect(router.state.location.pathname).toMatch(/^\/book\//)
  })
})

describe('library', () => {
  it('filters by status chip and by text, folding Danish letters', async () => {
    await addManual('Frøken Smillas fornemmelse for sne', 'Peter Høeg', 'reading')
    await addManual('Project Hail Mary', 'Andy Weir', 'to_read')
    const user = userEvent.setup()
    renderAt('/library')
    expect(await screen.findByText(t.screens.library.count(2))).toBeInTheDocument()

    const chips = screen.getByRole('group', { name: t.screens.book.statusLabel })
    await user.click(within(chips).getByRole('button', { name: new RegExp(t.status.to_read) }))
    expect(await screen.findByText(t.screens.library.count(1))).toBeInTheDocument()
    expect(screen.getByText('Project Hail Mary')).toBeInTheDocument()

    await user.click(within(chips).getByRole('button', { name: new RegExp(t.screens.library.all) }))
    await user.type(screen.getByLabelText(t.screens.library.filter), 'hoeg')
    expect(await screen.findByText(t.screens.library.count(1))).toBeInTheDocument()
    expect(screen.getByText('Frøken Smillas fornemmelse for sne')).toBeInTheDocument()
  })
})

describe('book screen', () => {
  it('logs a page and offers to finish at the last page', async () => {
    const id = await addManual('Kort bog', 'A. Forfatter', 'reading', 100)
    const user = userEvent.setup()
    renderAt(`/book/${id}`)
    const input = await screen.findByLabelText(t.screens.log.label)
    await user.type(input, '40')
    await user.click(screen.getByRole('button', { name: t.screens.log.submit }))
    expect(await screen.findByText(t.screens.log.logged(40))).toBeInTheDocument()

    await user.type(input, '100%')
    await user.click(screen.getByRole('button', { name: t.screens.log.submit }))
    await user.click(await screen.findByRole('button', { name: t.screens.log.markFinished }))
    await screen.findByRole('button', { name: t.statusLong.finished, pressed: true })
  })

  it('asks for the stop page when marking DNF', async () => {
    const id = await addManual('Svær bog', 'B. Forfatter', 'reading', 200)
    const user = userEvent.setup()
    renderAt(`/book/${id}`)
    await user.click(await screen.findByRole('button', { name: t.statusLong.dnf }))
    const stopAt = screen.getByLabelText(t.screens.book.stoppedAt)
    await user.type(stopAt, '50')
    await user.click(within(stopAt.closest('form')!).getByRole('button', { name: t.common.save }))
    await screen.findByRole('button', { name: t.statusLong.dnf, pressed: true })
    const entry = await services.db.entries.get(id)
    expect(entry?.status).toBe('dnf')
  })

  it('explains that a book with sessions goes to DNF, not back to To read', async () => {
    const id = await addManual('Halvlæst', 'C. Forfatter', 'reading', 200)
    await services.library.logPage(id, 30)
    const user = userEvent.setup()
    renderAt(`/book/${id}`)
    await user.click(await screen.findByRole('button', { name: t.statusLong.to_read }))
    expect(await screen.findByText(t.screens.book.markDnfInstead)).toBeInTheDocument()
  })
})
