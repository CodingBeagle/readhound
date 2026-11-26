import 'fake-indexeddb/auto'

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { routes } from '@/app/routes'
import { createServices, ServicesProvider, type Services } from '@/app/services'
import { createBackup } from '@/db/backup'
import { ReadhoundDB } from '@/db/schema'
import { t } from '@/i18n'
import { HttpClient } from '@/sources/http'
import { fixtureFetch } from '@/sources/openlibrary/fixtureFetch'
import { OpenLibrarySource } from '@/sources/openlibrary/OpenLibrarySource'
import { SourceRegistry } from '@/sources/registry'
import { WikidataGenreLookup } from '@/sources/genres/wikidataGenres'
import sampleGenres from '@/sources/genres/__fixtures__/sparql-genres-sample.json'
import { SeriesDetector, WikidataSeriesLookup } from '@/sources/series'
import wikidataAfdelingQ from '@/sources/series/__fixtures__/sparql-afdeling-q.json'

let services: Services
let demoDbName: string
/** What the fake Wikidata query service answers; empty by default. */
let wikidataAnswer: unknown
const wikidataFetch: typeof fetch = async () => new Response(JSON.stringify(wikidataAnswer), { status: 200 })

beforeEach(async () => {
  const db = new ReadhoundDB(`ui-${crypto.randomUUID()}`)
  await db.open()
  const http = new HttpClient({ fetch: fixtureFetch, sleep: async () => {} })
  demoDbName = `test-demo-${crypto.randomUUID()}`
  try {
    localStorage.clear()
  } catch {
    // ignore
  }
  wikidataAnswer = { results: { bindings: [] } }
  const sources = new SourceRegistry([new OpenLibrarySource(http)])
  const seriesDetector = new SeriesDetector({
    wikidata: new WikidataSeriesLookup(new HttpClient({ fetch: wikidataFetch, sleep: async () => {} })),
    getEdition: async (ref) => (await sources.get(ref.source)?.getEdition(ref)) ?? null,
  })
  const genreLookup = new WikidataGenreLookup(new HttpClient({ fetch: wikidataFetch, sleep: async () => {} }))
  services = { ...createServices(db), sources, seriesDetector, genreLookup }
})
afterEach(async () => {
  await services.db.delete()
  await new ReadhoundDB(demoDbName).delete()
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ServicesProvider services={services} demoDbName={demoDbName}>
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
    // Owned with a format of my own copy, next to the reading status.
    await user.click(screen.getByRole('checkbox', { name: new RegExp(t.owned.own) }))
    await user.selectOptions(screen.getByLabelText(t.owned.format), 'audiobook')
    await user.click(screen.getByRole('button', { name: t.screens.add.submit }))

    await screen.findByRole('button', { name: t.statusLong.reading, pressed: true })
    expect(router.state.location.pathname).toMatch(/^\/book\//)
    expect(await services.db.entries.count()).toBe(1)
    const [entry] = await services.db.entries.toArray()
    expect(entry).toMatchObject({ status: 'reading', owned: true })
    expect((await services.db.editions.get(entry!.editionId))!.overrides.format).toBe('audiobook')
    expect(screen.getByText(t.owned.badge)).toBeInTheDocument()
  })

  it('offers manual entry when nothing is found', async () => {
    const user = userEvent.setup()
    renderAt('/search')
    await user.type(screen.getByLabelText(t.screens.search.label), 'no such book')
    expect(await screen.findByText(t.screens.search.noResults('no such book'), {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.screens.search.addManually })).toHaveAttribute('href', '/add/manual?title=no%20such%20book')
  })
})

describe('barcode scanning', () => {
  it('looks up a typed ISBN and goes straight to adding that edition', async () => {
    const user = userEvent.setup()
    const router = renderAt('/search')
    await user.click(screen.getByRole('button', { name: t.scan.open }))
    const dialog = await screen.findByRole('dialog', { name: t.scan.title })
    // jsdom has no camera, so the dialog says so and offers typing and a photo.
    await within(dialog).findByText(t.scan.noCamera)
    expect(within(dialog).getByRole('button', { name: t.scan.photo })).toBeInTheDocument()

    const input = within(dialog).getByLabelText(t.scan.typeLabel)
    await user.type(input, '978-0-593-13520-5')
    await user.click(within(dialog).getByRole('button', { name: t.scan.lookUp }))
    expect(within(dialog).getByText(t.scan.invalid)).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '978-0-593-13520-4')
    await user.click(within(dialog).getByRole('button', { name: t.scan.lookUp }))
    await screen.findByRole('heading', { name: t.screens.add.title })
    expect(screen.getByText('Project Hail Mary')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/add')

    await user.click(screen.getByRole('button', { name: t.screens.add.submit }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/book\//))
    const edition = (await services.db.editions.toArray())[0]!
    expect(edition.isbn13).toBe('9780593135204')
  })

  it('opens manual entry with the ISBN and language filled in when Open Library has no match', async () => {
    const user = userEvent.setup()
    const router = renderAt('/add/isbn/9788702173543')
    await screen.findByText(t.scan.notFound('9788702173543'))
    expect(router.state.location.pathname).toBe('/add/manual')
    expect(screen.getByLabelText(t.screens.manual.isbn)).toHaveValue('9788702173543')
    expect(screen.getByLabelText(t.screens.manual.language, { exact: false })).toHaveValue('dan')

    await user.type(screen.getByLabelText(t.screens.manual.bookTitle), 'Kongens Fald')
    await user.type(screen.getByLabelText(t.screens.manual.authors, { exact: false }), 'Johannes V. Jensen')
    await user.click(screen.getAllByRole('button', { name: /Save|Add/ }).at(-1)!)
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/book\//))
    const edition = (await services.db.editions.toArray())[0]!
    expect(edition).toMatchObject({ isbn13: '9788702173543', language: 'dan' })
  })

  it('closes the scanner with Escape', async () => {
    const user = userEvent.setup()
    renderAt('/search')
    await user.click(screen.getByRole('button', { name: t.scan.open }))
    await screen.findByRole('dialog', { name: t.scan.title })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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

describe('owned books', () => {
  it('marks a book as owned on its page, whatever its status, with the format of the copy', async () => {
    const entryId = await addManual('Kongens fald', 'Johannes V. Jensen', 'finished')
    const user = userEvent.setup()
    renderAt(`/book/${entryId}`)
    const own = await screen.findByRole('checkbox', { name: new RegExp(t.owned.own) })
    expect(own).not.toBeChecked()
    await user.click(own)
    await waitFor(async () => expect((await services.db.entries.get(entryId))!.owned).toBe(true))
    expect(await screen.findByText(t.owned.badge)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.statusLong.finished, pressed: true })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(t.owned.format), 'hardcover')
    await waitFor(async () => {
      const entry = await services.db.entries.get(entryId)
      expect((await services.db.editions.get(entry!.editionId))!.overrides.format).toBe('hardcover')
    })
  })

  it('filters the library to owned books, and with To read to the ones owned but not read', async () => {
    const mine = await addManual('Project Hail Mary', 'Andy Weir', 'to_read')
    const read = await addManual('The Martian', 'Andy Weir', 'finished')
    await addManual('Artemis', 'Andy Weir', 'to_read') // borrowed
    await services.library.setOwned(mine, true)
    await services.library.setOwned(read, true)
    const user = userEvent.setup()
    const router = renderAt('/library')
    expect(await screen.findByText(t.screens.library.count(3))).toBeInTheDocument()
    const chips = screen.getByRole('group', { name: t.screens.book.statusLabel })
    await user.click(within(chips).getByRole('button', { name: t.owned.filter }))
    expect(await screen.findByText(t.screens.library.count(2))).toBeInTheDocument()
    expect(router.state.location.search).toContain('owned=1')
    await user.click(within(chips).getByRole('button', { name: new RegExp(t.status.to_read) }))
    expect(await screen.findByText(t.screens.library.count(1))).toBeInTheDocument()
    expect(screen.getByText('Project Hail Mary')).toBeInTheDocument()
  })
})

describe('cover photos', () => {
  const photo = { dataUrl: 'data:image/jpeg;base64,/9j/AAAA', width: 600, height: 900 }

  it('offers a cover photo for a book without a cover, and shows a stored one until it is removed', async () => {
    const entryId = await addManual('Kongens fald', 'Johannes V. Jensen')
    const user = userEvent.setup()
    renderAt(`/book/${entryId}`)
    await user.click(await screen.findByRole('button', { name: t.covers.add }))
    expect(screen.getByLabelText(t.covers.takePhotoLabel)).toHaveAttribute('capture', 'environment')
    expect(screen.getByLabelText(t.covers.chooseImageLabel)).toHaveAttribute('accept', 'image/*')
    expect(screen.queryByRole('button', { name: t.covers.remove })).not.toBeInTheDocument()

    await act(() => services.library.setCoverPhoto(entryId, photo))
    await waitFor(() => expect(document.querySelector(`header img[src="${photo.dataUrl}"]`)).not.toBeNull())
    await user.click(screen.getByRole('button', { name: t.covers.remove }))
    await waitFor(() => expect(document.querySelector('header img')).toBeNull())
    expect(screen.getByLabelText(`${t.common.noCover}: Kongens fald`)).toBeInTheDocument()
    expect(await services.db.covers.count()).toBe(0)
  })

  it('shows the stored photo in the library too', async () => {
    const entryId = await addManual('Kongens fald', 'Johannes V. Jensen')
    await services.library.setCoverPhoto(entryId, photo)
    renderAt('/library')
    await waitFor(() => expect(document.querySelector(`img[src="${photo.dataUrl}"]`)).not.toBeNull())
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

describe('profile: lists, categories and notes', () => {
  it('creates a list and a genre, assigns them on the book page, and filters the library', async () => {
    const id = await addManual('Kvinden i buret', 'Jussi Adler-Olsen', 'reading', 400)
    await addManual('Project Hail Mary', 'Andy Weir')
    const user = userEvent.setup()
    const router = renderAt('/profile')

    await user.type(await screen.findByLabelText(t.screens.profile.lists.name), 'Summer holiday')
    await user.click(screen.getByRole('button', { name: t.screens.profile.lists.add }))
    expect(await screen.findByText('Summer holiday')).toBeInTheDocument()

    await user.type(screen.getByLabelText(t.screens.profile.categories.name), 'Krimi')
    await user.selectOptions(screen.getByLabelText(t.screens.profile.categories.fiction), 'fiction')
    await user.click(screen.getByRole('button', { name: t.screens.profile.categories.add }))
    expect(await screen.findByText('Genre · Fiction')).toBeInTheDocument()

    await act(() => router.navigate(`/book/${id}`))
    const lists = await screen.findByRole('group', { name: t.screens.book.lists })
    await user.click(within(lists).getByRole('button', { name: 'Summer holiday' }))
    const cats = screen.getByRole('group', { name: t.screens.book.categories })
    await user.click(within(cats).getByRole('button', { name: 'Krimi' }))
    await within(cats).findByRole('button', { name: 'Krimi', pressed: true })

    await act(() => router.navigate('/library'))
    expect(await screen.findByText(t.screens.library.count(2))).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(t.screens.library.listFilter), 'Summer holiday')
    expect(await screen.findByText(t.screens.library.count(1))).toBeInTheDocument()
    expect(screen.getByText('Kvinden i buret')).toBeInTheDocument()
  })

  it('adds a quote with a page on the book page', async () => {
    const id = await addManual('Det', 'Inger Christensen', 'reading', 240)
    const user = userEvent.setup()
    renderAt(`/book/${id}`)
    await user.type(await screen.findByLabelText(t.screens.book.noteText), 'En linje jeg vil huske')
    await user.selectOptions(screen.getByLabelText(t.screens.book.noteKind), 'quote')
    await user.type(screen.getByLabelText(t.screens.book.notePage), '12')
    await user.click(screen.getByRole('button', { name: t.screens.book.addNote }))
    expect(await screen.findByText('En linje jeg vil huske')).toBeInTheDocument()
    expect(screen.getByText('Quote · p. 12')).toBeInTheDocument()
  })

  it('saves a reading goal', async () => {
    const user = userEvent.setup()
    renderAt('/profile')
    const year = new Date().getFullYear()
    await user.type(await screen.findByLabelText(t.screens.profile.goal.books), '24')
    await user.click(within(screen.getByRole('heading', { name: t.screens.profile.goal.title(year) }).closest('section')!).getByRole('button', { name: t.common.save }))
    // Saving a goal re-runs the goal pace and achievements over the whole library, so allow more than the
    // default second for the write and the confirmation on a busy test runner. The form re-mounts once the
    // saved goal reads back, which can swap the status line for a new one between finding it and checking
    // it, so query afresh inside waitFor rather than holding on to the first element found.
    await waitFor(() => expect(screen.getByText(t.screens.profile.goal.saved)).toBeInTheDocument(), { timeout: 4000 })
    expect(await services.db.goals.get(year)).toEqual({ year, targetBooks: 24 })
  })
})

describe('backup', () => {
  it('imports a backup file after confirming, replacing the library', async () => {
    await addManual('Old book', 'Someone')
    const backup = await createBackup(services.db, services.clock, 'test')
    await services.library.addManual({ title: 'Added after backup', authors: ['X'] })
    const user = userEvent.setup()
    renderAt('/profile')
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText(t.screens.profile.backup.importJson, { selector: 'input' }), file)
    expect(await screen.findByText(/This backup has 1 books/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t.screens.profile.backup.importConfirm }))
    expect(await screen.findByText(t.screens.profile.backup.imported)).toBeInTheDocument()
    expect((await services.db.editions.toArray()).map((e) => e.title)).toEqual(['Old book'])
  })

  it('explains why a file is rejected', async () => {
    const user = userEvent.setup()
    renderAt('/profile')
    const file = new File(['{"hello":1}'], 'other.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText(t.screens.profile.backup.importJson, { selector: 'input' }), file)
    expect(await screen.findByRole('alert')).toHaveTextContent('not a Readhound backup')
  })
})

describe('demo mode', () => {
  it('switches to sample data without touching the real library, and back', async () => {
    await addManual('My real book', 'Me')
    const user = userEvent.setup()
    renderAt('/demo')
    await user.click(await screen.findByRole('button', { name: t.demo.enter }))
    expect(await screen.findByText(t.demo.banner, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: t.screens.home.title })).toBeInTheDocument()
    expect(screen.queryByText('My real book')).not.toBeInTheDocument()
    expect(await services.db.entries.count()).toBe(1)

    await user.click(screen.getByRole('link', { name: t.tabs.library }))
    expect(await screen.findByText(/^\d\d books$/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.demo.leave }))
    expect(screen.queryByText(t.demo.banner)).not.toBeInTheDocument()
    expect(await screen.findByText('My real book')).toBeInTheDocument()
  })
})

describe('stats', () => {
  it('suggests demo mode when there is nothing to show', async () => {
    renderAt('/stats')
    expect(await screen.findByText(t.screens.stats.empty, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.demo.title })).toHaveAttribute('href', '/demo')
  })

  it('shows every stat section for the demo library, with tables behind the charts', async () => {
    const user = userEvent.setup()
    const router = renderAt('/demo')
    await user.click(await screen.findByRole('button', { name: t.demo.enter }))
    await screen.findByText(t.demo.banner, {}, { timeout: 5000 })
    await act(() => router.navigate('/stats?period=all'))
    expect(await screen.findByText(t.screens.stats.booksPerMonth, {}, { timeout: 5000 })).toBeInTheDocument()
    for (const title of Object.values(t.screens.stats.sections)) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    for (const title of [t.screens.stats.heatmap, t.screens.stats.genres, t.screens.stats.topAuthors, t.screens.stats.whereIStop, t.screens.stats.ownedShelf])
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getAllByText(t.screens.stats.showTable).length).toBeGreaterThan(10)
    expect((await screen.findAllByText(t.achievements.open)).length).toBeGreaterThan(0)
    const rereadCard = screen.getByRole('heading', { name: t.screens.stats.rereads }).closest('section')!
    expect(within(rereadCard).getByText('The Hobbit')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(t.screens.stats.period), 'custom')
    expect(router.state.location.search).toContain('period=custom')
    expect(screen.getByLabelText(t.screens.stats.from)).toBeInTheDocument()
  })
})

describe('year in review', () => {
  it('steps through the cards for a demo year with buttons and arrow keys', async () => {
    const user = userEvent.setup()
    const router = renderAt('/demo')
    await user.click(await screen.findByRole('button', { name: t.demo.enter }))
    await screen.findByText(t.demo.banner, {}, { timeout: 5000 })
    const year = new Date().getFullYear() - 1
    await act(() => router.navigate(`/stats/year/${year}`))
    const dialog = await screen.findByRole('dialog', { name: t.review.title(year) }, { timeout: 5000 })
    expect(within(dialog).getByRole('heading', { name: t.review.intro(year) })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: t.review.next }))
    expect(within(dialog).getByText(t.review.totals)).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(within(dialog).getByText(t.review.topAuthors)).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(within(dialog).getByText(t.review.totals)).toBeInTheDocument()

    for (let i = 0; i < 12 && within(dialog).queryByRole('button', { name: t.review.next }); i++) await user.click(within(dialog).getByRole('button', { name: t.review.next }))
    expect(within(dialog).getByRole('button', { name: t.review.save })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(router.state.location.pathname).toBe('/stats')
  })
})

describe('series', () => {
  it('adds a book to a new series with a number, then renumbers it', async () => {
    const user = userEvent.setup()
    const entryId = await addManual('Kvinden i buret', 'Jussi Adler-Olsen')
    renderAt(`/book/${entryId}`)
    await user.click(await screen.findByRole('button', { name: t.series.add }))
    await user.type(await screen.findByLabelText(t.series.newName), 'Afdeling Q')
    await user.type(screen.getByLabelText(t.series.position), '1')
    await user.click(screen.getByRole('button', { name: t.common.save }))
    expect(await screen.findByRole('link', { name: 'Afdeling Q #1' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `${t.series.edit} Afdeling Q` }))
    const position = await screen.findByLabelText(t.series.position)
    await user.clear(position)
    await user.type(position, 'x')
    await user.click(screen.getByRole('button', { name: t.common.save }))
    expect(await screen.findByText(t.series.invalidPosition)).toBeInTheDocument()
    await user.clear(position)
    await user.type(position, '1,5')
    await user.click(screen.getByRole('button', { name: t.common.save }))
    expect(await screen.findByRole('link', { name: 'Afdeling Q #1.5' })).toBeInTheDocument()
  })

  it('suggests the series Wikidata knows for a book from Open Library', async () => {
    wikidataAnswer = wikidataAfdelingQ
    const user = userEvent.setup()
    const edition = (await services.sources.lookupIsbn('9780593135204'))!.edition
    const { entryId } = await services.library.addFromSource({ edition })
    renderAt(`/book/${entryId}`)
    const suggestion = await screen.findByRole('region', { name: t.series.suggestion }, { timeout: 3000 })
    expect(within(suggestion).getByText('Afdeling Q, book 1')).toBeInTheDocument()
    await user.click(within(suggestion).getByRole('button', { name: t.series.accept }))
    expect(await screen.findByRole('link', { name: 'Afdeling Q #1' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: t.series.suggestion })).not.toBeInTheDocument()
    expect(await services.db.seriesMembers.count()).toBe(3)
  })
})

describe('series screens', () => {
  async function seedSeries() {
    const one = await addManual('Kvinden i buret', 'Jussi Adler-Olsen', 'finished')
    const two = await addManual('Fasandræberne', 'Jussi Adler-Olsen', 'to_read')
    const workOf = async (entryId: string) => (await services.db.editions.get((await services.db.entries.get(entryId))!.editionId))!.workId
    const q = await services.series.createSeries({ name: 'Afdeling Q', totalBooks: 4 })
    await services.series.setWorkSeries(await workOf(one), q, { position: 1 })
    await services.series.setWorkSeries(await workOf(two), q, { position: 2 })
    await services.series.addMissingMember(q, { title: 'Flaskepost fra P', position: 3, authorName: 'Jussi Adler-Olsen' })
    return { q, one, two }
  }

  it('lists series with progress from the library, and opens one in order', async () => {
    const user = userEvent.setup()
    await seedSeries()
    await addManual('Dune', 'Frank Herbert')
    const router = renderAt('/library')
    await user.click(await screen.findByRole('link', { name: t.series.libraryLink }))
    const card = await screen.findByRole('link', { name: /Afdeling Q/ })
    expect(within(card).getByText(t.series.progress(1, 4))).toBeInTheDocument()
    expect(within(card).getByText(t.series.owned(2, 4))).toBeInTheDocument()
    await user.click(card)
    expect(router.state.location.pathname).toMatch(/^\/series\//)
    await screen.findByRole('heading', { name: 'Afdeling Q' })
    const titles = screen.getAllByText(/^(Kvinden i buret|Fasandræberne|Flaskepost fra P)$/).map((e) => e.textContent)
    expect(titles).toEqual(['Kvinden i buret', 'Fasandræberne', 'Flaskepost fra P'])
    const missing = screen.getByRole('link', { name: `${t.series.findMissing}: Flaskepost fra P` })
    expect(missing).toHaveAttribute('href', '/search?q=Flaskepost%20fra%20P%20Jussi%20Adler-Olsen')
  })

  it('filters the library by series', async () => {
    const user = userEvent.setup()
    await seedSeries()
    await addManual('Dune', 'Frank Herbert')
    renderAt('/library')
    await screen.findByText('Dune')
    await user.selectOptions(await screen.findByLabelText(t.series.filter), 'Afdeling Q')
    expect(await screen.findByText(t.screens.library.count(2))).toBeInTheDocument()
    expect(screen.queryByText('Dune')).not.toBeInTheDocument()
  })

  it('shows the next book in the series on Home with one tap to start it', async () => {
    const user = userEvent.setup()
    const { two } = await seedSeries()
    renderAt('/')
    const start = await screen.findByRole('button', { name: `${t.series.startNext}: Fasandræberne` })
    expect(screen.getByText(t.series.nextLine('Afdeling Q', '2'))).toBeInTheDocument()
    await user.click(start)
    await screen.findByRole('link', { name: /Fasandræberne/ })
    expect((await services.db.entries.get(two))!.status).toBe('reading')
  })

  it('edits the series name and total, and deletes it without touching the books', async () => {
    const user = userEvent.setup()
    const { q } = await seedSeries()
    const router = renderAt(`/series/${q}`)
    await user.click(await screen.findByRole('button', { name: t.series.rename }))
    const name = screen.getByLabelText(t.series.newName)
    await user.clear(name)
    await user.type(name, 'Department Q')
    const total = screen.getByLabelText(t.series.totalBooks)
    await user.clear(total)
    await user.type(total, '10')
    await user.click(screen.getByRole('button', { name: t.common.save }))
    expect(await screen.findByRole('heading', { name: 'Department Q' })).toBeInTheDocument()
    expect(screen.getByText(t.series.progress(1, 10))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.series.deleteSeries }))
    await user.click(screen.getByRole('button', { name: t.common.delete }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/series'))
    expect(await services.db.series.count()).toBe(0)
    expect(await services.db.entries.count()).toBe(2)
  })
})

describe('recommendations', () => {
  it('suggests more by a loved author, adds one to To read and dismisses another', async () => {
    const user = userEvent.setup()
    const entryId = await addManual('Project Hail Mary', 'Andy Weir', 'finished')
    await services.library.setRating(entryId, 5)
    renderAt('/for-you')

    expect(await screen.findByText(t.recommendations.tasteTitle)).toBeInTheDocument()
    const martian = (await screen.findAllByText('The Martian', {}, { timeout: 5000 }))[0]!.closest('li')!
    expect(within(martian).getByText(t.recommendations.because.author('Andy Weir', 'Project Hail Mary'))).toBeInTheDocument()
    expect(screen.queryByText('Project Hail Mary', { selector: 'a' })).not.toBeInTheDocument()

    await user.click(within(martian).getByRole('button', { name: `${t.recommendations.addToRead}: The Martian` }))
    expect(await screen.findByText(t.recommendations.added('The Martian'))).toBeInTheDocument()
    const added = await services.db.entries.where('status').equals('to_read').toArray()
    expect(added).toHaveLength(1)
    expect(screen.queryByRole('button', { name: `${t.recommendations.addToRead}: The Martian` })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `${t.recommendations.dismiss}: Artemis` }))
    expect(await screen.findByText(t.recommendations.dismissed('Artemis'))).toBeInTheDocument()
    // The pick leaves once the dismissed list is read back from the database, which can take more than one tick.
    await waitFor(() => expect(screen.queryByRole('button', { name: `${t.recommendations.dismiss}: Artemis` })).not.toBeInTheDocument())
    expect((await services.db.settings.get('recommendationsDismissed'))?.value).toHaveLength(1)
  })

  it('asks for ratings before it has anything to go on', async () => {
    await addManual('Unread', 'Someone')
    renderAt('/for-you')
    expect(await screen.findByText(t.recommendations.needRatings)).toBeInTheDocument()
  })
})

describe('genre suggestions', () => {
  it('prefills suggested genres when adding a book and learns from what was switched off', async () => {
    wikidataAnswer = sampleGenres
    const user = userEvent.setup()
    renderAt('/search')
    await user.type(screen.getByLabelText(t.screens.search.label), 'froken smilla')
    await user.click((await screen.findAllByText('Frøken Smillas fornemmelse for sne', {}, { timeout: 3000 }))[0]!)
    await user.click((await screen.findAllByRole('link', { name: /Smilla/ }))[0]!)

    const group = await screen.findByRole('group', { name: t.genres.suggested }, { timeout: 3000 })
    const crime = within(group).getByRole('button', { name: /Crime & mystery/ })
    const thriller = within(group).getByRole('button', { name: /Thriller/ })
    expect(crime).toHaveAttribute('aria-pressed', 'true')
    expect(thriller).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByText(t.genres.from(['Wikidata']))).toBeInTheDocument()
    await user.click(thriller)
    expect(thriller).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: t.screens.add.submit }))

    await screen.findByRole('button', { name: t.statusLong.to_read, pressed: true })
    const categories = await services.db.categories.toArray()
    expect(categories.map((c) => c.name)).toEqual(['Crime & mystery'])
    const [entry] = await services.db.entries.toArray()
    expect(entry!.categoryIds).toEqual([categories[0]!.id])
    expect((await services.db.settings.get('genreLearning'))?.value).toMatchObject({ 'a:peter høeg': { thriller: -1 } })
  })

  it('suggests a genre on a book without one, from the author\'s other books', async () => {
    const user = userEvent.setup()
    const krimi = await services.collections.createCategory({ name: 'Krimi', kind: 'genre', isFiction: true })
    await services.library.addManual({ title: 'Kvinden i buret', authors: ['Jussi Adler-Olsen'] }, { categoryIds: [krimi] })
    await services.library.addManual({ title: 'Fasandræberne', authors: ['Jussi Adler-Olsen'] }, { categoryIds: [krimi] })
    const id = await addManual('Journal 64', 'Jussi Adler-Olsen')
    renderAt(`/book/${id}`)

    const group = await screen.findByRole('group', { name: t.genres.bookHint }, { timeout: 3000 })
    await user.click(within(group).getByRole('button', { name: /Krimi/ }))
    await waitFor(async () => expect((await services.db.entries.get(id))!.categoryIds).toEqual([krimi]))
    await waitFor(() => expect(screen.queryByRole('group', { name: t.genres.bookHint })).not.toBeInTheDocument())
  })

  it('suggests genres for the whole library and applies them', async () => {
    const user = userEvent.setup()
    const krimi = await services.collections.createCategory({ name: 'Krimi', kind: 'genre', isFiction: true })
    await services.library.addManual({ title: 'Kvinden i buret', authors: ['Jussi Adler-Olsen'] }, { categoryIds: [krimi] })
    await services.library.addManual({ title: 'Fasandræberne', authors: ['Jussi Adler-Olsen'] }, { categoryIds: [krimi] })
    const a = await addManual('Journal 64', 'Jussi Adler-Olsen')
    const b = await addManual('Marco effekten', 'Jussi Adler-Olsen')
    const c = await addManual('Something else', 'Nobody Known')
    renderAt('/profile')
    expect(await screen.findByText(t.genres.backfill.openHint(3))).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: t.genres.backfill.open }))

    expect(await screen.findByText(t.genres.backfill.done(3), {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText(t.genres.backfill.noSuggestion)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t.genres.backfill.applyAll(2) }))
    await waitFor(async () => expect((await services.db.entries.get(b))!.categoryIds).toEqual([krimi]))
    expect((await services.db.entries.get(a))!.categoryIds).toEqual([krimi])
    expect((await services.db.entries.get(c))!.categoryIds).toEqual([])
    await waitFor(() => expect(screen.getAllByText(new RegExp(t.genres.backfill.applied))).toHaveLength(2))
  })
})
