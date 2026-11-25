/**
 * Sample data for demo mode: about two years of made-up reading, so the
 * library and stats screens have something realistic to show. The data is
 * generated from a fixed seed, so it is the same every time for a given day.
 *
 * Books are real titles with approximate page counts; ratings, dates,
 * sessions, notes and lists are invented.
 */
import type { BackupData } from '@/db/backup'
import type { Author, Category, Edition, EditionFormat, LibraryEntry, List, ListItem, Note, Read, ReadingSession, Series, SeriesMember, Work } from '@/domain/types'

interface SampleBook {
  title: string
  author: string
  year: number
  pages: number
  lang: 'dan' | 'eng'
  /** Original language when the edition is a translation. */
  orig?: string
  genre: GenreKey
  format?: EditionFormat
  /** What happens to the book in the sample timeline. */
  plan: 'finish' | 'dnf' | 'reread' | 'to_read' | 'old'
  lists?: ListKey[]
  favourite?: boolean
  /** Whether the reader owns a copy (default: three in four books). */
  owned?: boolean
  /** Series and number in it. */
  series?: [SeriesKey, number]
}

type GenreKey = 'crime' | 'scifi' | 'fantasy' | 'literary' | 'classic' | 'memoir' | 'science' | 'selfhelp' | 'poetry'
type ListKey = 'classics' | 'summer' | 'club'
type SeriesKey = 'copenhagen' | 'q' | 'earthsea' | 'dune' | 'kingkiller' | 'millennium' | 'threeBody'

/** Series in the sample library, with the books the sample reader doesn't own yet. */
const SERIES: Record<SeriesKey, { name: string; author: string; totalBooks?: number; missing: [string, number][] }> = {
  copenhagen: { name: 'Københavnertrilogien', author: 'Tove Ditlevsen', missing: [] },
  q: { name: 'Afdeling Q', author: 'Jussi Adler-Olsen', totalBooks: 10, missing: [['Flaskepost fra P', 3], ['Journal 64', 4], ['Marco Effekten', 5]] },
  earthsea: {
    name: 'Earthsea',
    author: 'Ursula K. Le Guin',
    missing: [['The Tombs of Atuan', 2], ['The Farthest Shore', 3], ['Tehanu', 4], ['Tales from Earthsea', 5], ['The Other Wind', 6]],
  },
  dune: { name: 'Dune', author: 'Frank Herbert', totalBooks: 6, missing: [['Dune Messiah', 2], ['Children of Dune', 3]] },
  kingkiller: { name: 'The Kingkiller Chronicle', author: 'Patrick Rothfuss', missing: [["The Wise Man's Fear", 2], ['The Slow Regard of Silent Things', 2.5]] },
  millennium: { name: 'Millennium', author: 'Stieg Larsson', missing: [['The Girl Who Played with Fire', 2], ["The Girl Who Kicked the Hornets' Nest", 3]] },
  threeBody: { name: "Remembrance of Earth's Past", author: 'Cixin Liu', missing: [['The Dark Forest', 2], ["Death's End", 3]] },
}

const GENRES: Record<GenreKey, { name: string; isFiction: boolean }> = {
  crime: { name: 'Krimi', isFiction: true },
  scifi: { name: 'Science fiction', isFiction: true },
  fantasy: { name: 'Fantasy', isFiction: true },
  literary: { name: 'Literary fiction', isFiction: true },
  classic: { name: 'Klassiker', isFiction: true },
  memoir: { name: 'Memoir', isFiction: false },
  science: { name: 'Popular science', isFiction: false },
  selfhelp: { name: 'Self-help', isFiction: false },
  poetry: { name: 'Poetry', isFiction: true },
}

const LISTS: Record<ListKey, { name: string; description?: string }> = {
  classics: { name: 'Danske klassikere', description: 'The Danish canon, slowly.' },
  summer: { name: 'Summer holiday', description: 'For the beach and the summer house.' },
  club: { name: 'Book club', description: 'Picks from the monthly book club.' },
}

const AUTHOR_COUNTRIES: Record<string, string> = {
  'Peter Høeg': 'DK',
  'Johannes V. Jensen': 'DK',
  'Tove Ditlevsen': 'DK',
  'Jussi Adler-Olsen': 'DK',
  'Hans Scherfig': 'DK',
  'Henrik Pontoppidan': 'DK',
  'Tom Kristensen': 'DK',
  'Karen Blixen': 'DK',
  'Inger Christensen': 'DK',
  'Helle Helle': 'DK',
  'Andy Weir': 'US',
  'Frank Herbert': 'US',
  'Ursula K. Le Guin': 'US',
  'Yuval Noah Harari': 'IL',
  'Daniel Kahneman': 'US',
  'Tara Westover': 'US',
  'Kazuo Ishiguro': 'GB',
  'Sally Rooney': 'IE',
  'J. R. R. Tolkien': 'GB',
  'Susanna Clarke': 'GB',
  'Patrick Rothfuss': 'US',
  'James Clear': 'US',
  'Bill Bryson': 'US',
  'Emily St. John Mandel': 'CA',
  'Cormac McCarthy': 'US',
  'Min Jin Lee': 'US',
  'Madeline Miller': 'US',
  'Alex Michaelides': 'GB',
  'Gillian Flynn': 'US',
  'Stieg Larsson': 'SE',
  'Robin Wall Kimmerer': 'US',
  'Cixin Liu': 'CN',
  'George Orwell': 'GB',
}

/** Roughly in the order they are read. */
const BOOKS: SampleBook[] = [
  { title: 'Kongens Fald', author: 'Johannes V. Jensen', year: 1901, pages: 272, lang: 'dan', genre: 'classic', plan: 'old', lists: ['classics'] },
  { title: 'The Hobbit', author: 'J. R. R. Tolkien', year: 1937, pages: 310, lang: 'eng', genre: 'fantasy', plan: 'reread', favourite: true },
  { title: 'Nineteen Eighty-Four', author: 'George Orwell', year: 1949, pages: 328, lang: 'eng', genre: 'classic', plan: 'reread' },
  { title: 'Frøken Smillas fornemmelse for sne', author: 'Peter Høeg', year: 1992, pages: 435, lang: 'dan', genre: 'crime', plan: 'finish', favourite: true },
  { title: 'The Martian', author: 'Andy Weir', year: 2011, pages: 369, lang: 'eng', genre: 'scifi', plan: 'finish', format: 'ebook' },
  { title: 'Barndom', author: 'Tove Ditlevsen', year: 1967, pages: 112, lang: 'dan', genre: 'memoir', plan: 'finish', lists: ['classics', 'club'], series: ['copenhagen', 1] },
  { title: 'Ungdom', author: 'Tove Ditlevsen', year: 1967, pages: 128, lang: 'dan', genre: 'memoir', plan: 'finish', lists: ['classics'], series: ['copenhagen', 2] },
  { title: 'Gift', author: 'Tove Ditlevsen', year: 1971, pages: 184, lang: 'dan', genre: 'memoir', plan: 'finish', lists: ['classics'], series: ['copenhagen', 3] },
  { title: 'Sapiens', author: 'Yuval Noah Harari', year: 2011, pages: 443, lang: 'eng', orig: 'heb', genre: 'science', plan: 'finish' },
  { title: 'Kvinden i buret', author: 'Jussi Adler-Olsen', year: 2007, pages: 400, lang: 'dan', genre: 'crime', plan: 'finish', lists: ['summer'], series: ['q', 1] },
  { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', year: 2011, pages: 499, lang: 'eng', genre: 'science', plan: 'dnf' },
  { title: 'Fasandræberne', author: 'Jussi Adler-Olsen', year: 2008, pages: 456, lang: 'dan', genre: 'crime', plan: 'finish', lists: ['summer'], series: ['q', 2] },
  { title: 'Educated', author: 'Tara Westover', year: 2018, pages: 334, lang: 'eng', genre: 'memoir', plan: 'finish', lists: ['club'] },
  { title: 'The Remains of the Day', author: 'Kazuo Ishiguro', year: 1989, pages: 245, lang: 'eng', genre: 'literary', plan: 'finish' },
  { title: 'Det forsømte forår', author: 'Hans Scherfig', year: 1940, pages: 208, lang: 'dan', genre: 'classic', plan: 'finish', lists: ['classics'] },
  { title: 'Dune', author: 'Frank Herbert', year: 1965, pages: 617, lang: 'eng', genre: 'scifi', plan: 'finish', format: 'paperback', series: ['dune', 1] },
  { title: 'Normal People', author: 'Sally Rooney', year: 2018, pages: 266, lang: 'eng', genre: 'literary', plan: 'finish', lists: ['club'] },
  { title: 'Lykke-Per', author: 'Henrik Pontoppidan', year: 1898, pages: 704, lang: 'dan', genre: 'classic', plan: 'dnf', lists: ['classics'] },
  { title: 'Piranesi', author: 'Susanna Clarke', year: 2020, pages: 245, lang: 'eng', genre: 'fantasy', plan: 'finish', favourite: true },
  { title: 'Atomic Habits', author: 'James Clear', year: 2018, pages: 320, lang: 'eng', genre: 'selfhelp', plan: 'finish', format: 'audiobook' },
  { title: 'Den afrikanske farm', author: 'Karen Blixen', year: 1937, pages: 336, lang: 'dan', genre: 'memoir', plan: 'finish', lists: ['classics'] },
  { title: 'Station Eleven', author: 'Emily St. John Mandel', year: 2014, pages: 333, lang: 'eng', genre: 'scifi', plan: 'finish' },
  { title: 'The Silent Patient', author: 'Alex Michaelides', year: 2019, pages: 336, lang: 'eng', genre: 'crime', plan: 'finish', lists: ['summer'] },
  { title: 'Det', author: 'Inger Christensen', year: 1969, pages: 240, lang: 'dan', genre: 'poetry', plan: 'finish' },
  { title: 'Klara og solen', author: 'Kazuo Ishiguro', year: 2021, pages: 320, lang: 'dan', orig: 'eng', genre: 'literary', plan: 'finish', lists: ['club'] },
  { title: 'The Three-Body Problem', author: 'Cixin Liu', year: 2008, pages: 400, lang: 'eng', orig: 'chi', genre: 'scifi', plan: 'dnf', series: ['threeBody', 1] },
  { title: 'Vejen', author: 'Cormac McCarthy', year: 2006, pages: 240, lang: 'dan', orig: 'eng', genre: 'literary', plan: 'finish' },
  { title: 'Hvis det er', author: 'Helle Helle', year: 2014, pages: 160, lang: 'dan', genre: 'literary', plan: 'finish' },
  { title: 'Circe', author: 'Madeline Miller', year: 2018, pages: 393, lang: 'eng', genre: 'fantasy', plan: 'finish', lists: ['summer'] },
  { title: 'Project Hail Mary', author: 'Andy Weir', year: 2021, pages: 476, lang: 'eng', genre: 'scifi', plan: 'finish', favourite: true },
  { title: 'The Body', author: 'Bill Bryson', year: 2019, pages: 450, lang: 'eng', genre: 'science', plan: 'finish' },
  { title: 'Hærværk', author: 'Tom Kristensen', year: 1930, pages: 432, lang: 'dan', genre: 'classic', plan: 'finish', lists: ['classics'] },
  { title: 'Pachinko', author: 'Min Jin Lee', year: 2017, pages: 490, lang: 'eng', genre: 'literary', plan: 'finish', lists: ['club'] },
  { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', year: 1969, pages: 304, lang: 'eng', genre: 'scifi', plan: 'finish' },
  { title: 'Never Let Me Go', author: 'Kazuo Ishiguro', year: 2005, pages: 288, lang: 'eng', genre: 'literary', plan: 'finish' },
  { title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', year: 1968, pages: 183, lang: 'eng', genre: 'fantasy', plan: 'finish', series: ['earthsea', 1] },
  { title: 'Gone Girl', author: 'Gillian Flynn', year: 2012, pages: 419, lang: 'eng', genre: 'crime', plan: 'finish' },
  { title: 'The Name of the Wind', author: 'Patrick Rothfuss', year: 2007, pages: 662, lang: 'eng', genre: 'fantasy', plan: 'finish', series: ['kingkiller', 1] },
  { title: 'Barndommens gade', author: 'Tove Ditlevsen', year: 1943, pages: 224, lang: 'dan', genre: 'classic', plan: 'finish', lists: ['classics'] },
  { title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson', year: 2005, pages: 465, lang: 'eng', orig: 'swe', genre: 'crime', plan: 'to_read', lists: ['summer'], series: ['millennium', 1] },
  { title: 'A Short History of Nearly Everything', author: 'Bill Bryson', year: 2003, pages: 544, lang: 'eng', genre: 'science', plan: 'to_read' },
  { title: 'Braiding Sweetgrass', author: 'Robin Wall Kimmerer', year: 2013, pages: 391, lang: 'eng', genre: 'science', plan: 'to_read', lists: ['club'] },
]

const NOTES = [
  'Slow start, but it picked up a lot around the middle.',
  'Discuss at book club: the ending.',
  'Loved the descriptions of Copenhagen in winter.',
  'Re-read the first chapter after finishing; it lands differently.',
  'Recommended by a colleague.',
  'The narrator is not to be trusted.',
]

/** Small, fast, seedable random number generator (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` plus a number of days. */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

let counter = 0
/** Readable, unique IDs so the demo data is easy to recognise in a backup file. */
const id = (prefix: string) => `demo-${prefix}-${(++counter).toString(36)}`

export interface SampleOptions {
  /** Today's local date, `YYYY-MM-DD`. */
  today: string
  /** How many days of history to make. Default about two years. */
  days?: number
  seed?: number
  timeZone?: string
}

/**
 * Builds the complete sample database, ready for `restoreBackup`. The reading
 * pace is tuned so the queue of books lasts until today, leaving a book or
 * two in progress.
 */
export function buildSampleLibrary(options: SampleOptions): BackupData {
  const days = options.days ?? 730
  let pace = 1
  let run = simulate(options, pace)
  for (let attempt = 0; attempt < 5 && run.ranOutAfter !== undefined; attempt++) {
    pace *= (run.ranOutAfter / days) * 0.95
    run = simulate(options, pace)
  }
  return run.data
}

function simulate(options: SampleOptions, pace: number): { data: BackupData; ranOutAfter?: number } {
  const { today, days = 730, seed = 20261125, timeZone = 'Europe/Copenhagen' } = options
  let ranOutAfter: number | undefined
  let dayIndex = 0
  const rnd = random(seed)
  counter = 0
  const first = addDays(today, -days)
  const now = `${today}T12:00:00.000Z`

  const categories: Category[] = Object.entries(GENRES).map(([key, g]) => ({ id: `demo-genre-${key}`, name: g.name, kind: 'genre', isFiction: g.isFiction }))
  const favourites: Category = { id: 'demo-shelf-favourites', name: 'Favourites', kind: 'shelf' }
  categories.push(favourites)

  const lists: List[] = (Object.keys(LISTS) as ListKey[]).map((key, sortOrder) => ({
    id: `demo-list-${key}`,
    name: LISTS[key].name,
    description: LISTS[key].description,
    createdAt: `${first}T10:00:00.000Z`,
    sortOrder,
  }))

  const authors = new Map<string, Author>()
  const works: Work[] = []
  const editions: Edition[] = []
  const entries: LibraryEntry[] = []
  const reads: Read[] = []
  const sessions: ReadingSession[] = []
  const listItems: ListItem[] = []
  const notes: Note[] = []

  const books = BOOKS.map((book, index) => {
    let author = authors.get(book.author)
    if (!author) {
      author = { id: id('author'), name: book.author, country: AUTHOR_COUNTRIES[book.author], overrides: {} }
      authors.set(book.author, author)
    }
    const work: Work = {
      id: id('work'),
      title: book.title,
      authorIds: [author.id],
      firstPublishYear: book.year,
      originalLanguage: book.orig ?? book.lang,
      subjects: [],
      medianPageCount: book.pages,
    }
    const edition: Edition = {
      id: id('edition'),
      workId: work.id,
      title: book.title,
      publishYear: Math.max(book.year, rnd.int(2005, 2023)),
      pageCount: book.pages,
      language: book.lang,
      format: book.format ?? (rnd.chance(0.6) ? 'paperback' : 'hardcover'),
      borrowed: {},
      overrides: {},
    }
    const entry: LibraryEntry = {
      id: id('entry'),
      editionId: edition.id,
      status: 'to_read',
      addedAt: now,
      statusChangedAt: now,
      categoryIds: [`demo-genre-${book.genre}`, ...(book.favourite ? [favourites.id] : [])],
      favourite: book.favourite ?? false,
      // Most books are the reader's own; every fourth one was a library loan or borrowed.
      owned: book.owned ?? index % 4 !== 3,
    }
    works.push(work)
    editions.push(edition)
    entries.push(entry)
    return { book, entry, work }
  })

  // Series: the owned books at their numbers, plus the ones not owned yet.
  const series: Series[] = []
  const seriesMembers: SeriesMember[] = []
  for (const [key, def] of Object.entries(SERIES) as [SeriesKey, (typeof SERIES)[SeriesKey]][]) {
    const seriesId = `demo-series-${key}`
    series.push({ id: seriesId, name: def.name, totalBooks: def.totalBooks, origin: 'manual', createdAt: `${first}T10:00:00.000Z` })
    for (const { book, work } of books.filter((b) => b.book.series?.[0] === key))
      seriesMembers.push({ id: id('member'), seriesId, workId: work.id, title: book.title, position: book.series![1], origin: 'manual', addedAt: `${first}T10:00:00.000Z` })
    for (const [title, position] of def.missing)
      seriesMembers.push({ id: id('member'), seriesId, title, authorName: def.author, position, origin: 'manual', addedAt: `${first}T10:00:00.000Z` })
  }

  // Books finished before the history starts: dated reads without sessions.
  const old = books.filter((b) => b.book.plan === 'old' || b.book.plan === 'reread')
  for (const [i, { entry }] of old.entries()) {
    const endedOn = addDays(first, -30 * (i + 2))
    reads.push({ id: id('read'), entryId: entry.id, startedOn: addDays(endedOn, -rnd.int(7, 20)), endedOn, outcome: 'finished' })
    entry.addedAt = `${addDays(endedOn, -60)}T09:00:00.000Z`
    entry.status = 'finished'
    entry.statusChangedAt = `${endedOn}T20:00:00.000Z`
  }

  // The reading queue: everything planned, with the rereads again near the end.
  const queue = books.filter((b) => b.book.plan === 'finish' || b.book.plan === 'dnf')
  const rereads = books.filter((b) => b.book.plan === 'reread')
  queue.splice(queue.length - 6, 0, rereads[0]!)
  queue.splice(queue.length - 2, 0, rereads[1]!)

  interface Current {
    entry: LibraryEntry
    book: SampleBook
    read: Read
    page: number
    /** For DNF books: the page where the reader gives up. */
    giveUpAt?: number
  }
  const current: Current[] = []
  let nextStart = first

  const start = (date: string) => {
    const item = queue.shift()
    if (!item) return
    const { entry, book } = item
    const read: Read = { id: id('read'), entryId: entry.id, startedOn: date }
    reads.push(read)
    if (entry.status === 'to_read') entry.addedAt = `${addDays(date, -rnd.int(0, 90))}T09:00:00.000Z`
    entry.status = 'reading'
    entry.statusChangedAt = `${date}T19:00:00.000Z`
    for (const key of book.lists ?? []) {
      if (!listItems.some((li) => li.listId === `demo-list-${key}` && li.entryId === entry.id)) {
        const position = listItems.filter((li) => li.listId === `demo-list-${key}`).length
        listItems.push({ listId: `demo-list-${key}`, entryId: entry.id, position, addedAt: entry.addedAt })
      }
    }
    current.push({ entry, book, read, page: 0, giveUpAt: book.plan === 'dnf' ? Math.round(book.pages * (0.15 + rnd.next() * 0.4)) : undefined })
  }

  for (let date = first; date <= today; date = addDays(date, 1), dayIndex++) {
    if (current.length === 0 && date >= nextStart) start(date)
    if (current.length === 0 && queue.length === 0) {
      ranOutAfter ??= dayIndex
      continue
    }
    // Sometimes a second book runs alongside, often a short or non-fiction one.
    if (current.length === 1 && rnd.chance(0.02)) start(date)

    const weekend = [0, 6].includes(weekday(date))
    const summer = date.slice(5, 7) === '07'
    if (current.length === 0 || !rnd.chance(weekend || summer ? 0.85 : 0.6)) continue

    const item = rnd.pick(current)
    const { book } = item
    const pages = Math.max(4, Math.round(pace * (weekend ? 45 : 28) * (0.4 + rnd.next() * 1.2) * (book.format === 'audiobook' ? 1.4 : 1)))
    const toPage = Math.min(book.pages, item.giveUpAt ?? book.pages, item.page + pages)
    const hour = weekend && rnd.chance(0.5) ? rnd.int(9, 15) : rnd.int(19, 21)
    sessions.push({
      id: id('session'),
      readId: item.read.id,
      startedAt: `${date}T${String(hour).padStart(2, '0')}:${String(rnd.int(0, 59)).padStart(2, '0')}:00.000Z`,
      timeZone,
      durationMinutes: rnd.chance(0.8) ? Math.round((toPage - item.page) * (1.4 + rnd.next() * 0.8)) : undefined,
      fromPage: item.page,
      toPage,
      pagesRead: toPage - item.page,
    })
    item.page = toPage

    const done = toPage >= book.pages
    const gaveUp = item.giveUpAt !== undefined && toPage >= item.giveUpAt
    if (done || gaveUp) {
      item.read.endedOn = date
      item.read.outcome = done ? 'finished' : 'dnf'
      if (gaveUp) item.read.stoppedAtPage = toPage
      item.entry.status = done ? 'finished' : 'dnf'
      item.entry.statusChangedAt = `${date}T21:00:00.000Z`
      if (done && item.entry.rating === undefined) item.entry.rating = book.favourite ? rnd.pick([4.5, 5]) : rnd.pick([2.5, 3, 3.5, 3.5, 4, 4, 4, 4.5])
      if (gaveUp) item.entry.rating = rnd.pick([2, 2.5, 3])
      current.splice(current.indexOf(item), 1)
      nextStart = addDays(date, rnd.int(0, 3))
    }
  }

  // Between books today: pick up the next one, so Home has something to show.
  if (current.length === 0 && queue.length > 0) start(today)

  // Unread books and anything the timeline didn't reach stay on the to-read pile.
  for (const { entry, book } of books) {
    if (entry.status !== 'to_read') continue
    entry.addedAt = `${addDays(today, -rnd.int(5, days))}T09:00:00.000Z`
    entry.statusChangedAt = entry.addedAt
    for (const key of book.lists ?? []) {
      const position = listItems.filter((li) => li.listId === `demo-list-${key}`).length
      listItems.push({ listId: `demo-list-${key}`, entryId: entry.id, position, addedAt: entry.addedAt })
    }
  }

  // A few notes and a quote on books that have been read.
  const started = books.filter((b) => b.entry.status !== 'to_read')
  for (const [i, text] of NOTES.entries()) {
    const { entry, book } = started[(i * 5 + 3) % started.length]!
    notes.push({
      id: id('note'),
      entryId: entry.id,
      kind: 'note',
      text,
      page: i % 2 === 0 ? rnd.int(10, book.pages - 10) : undefined,
      createdAt: entry.statusChangedAt,
      updatedAt: entry.statusChangedAt,
    })
  }
  notes.push({
    id: id('note'),
    entryId: started[0]!.entry.id,
    kind: 'quote',
    text: 'Sample quote: save the lines you want to keep, with the page they are on.',
    page: 42,
    createdAt: now,
    updatedAt: now,
  })

  const year = Number(today.slice(0, 4))
  const data: BackupData = {
    works,
    editions,
    authors: [...authors.values()],
    entries,
    reads,
    sessions,
    lists,
    listItems,
    categories,
    notes,
    goals: [
      { year: year - 1, targetBooks: 20, targetPages: 6000 },
      { year, targetBooks: 18 },
    ],
    settings: [
      { key: 'preferredLanguages', value: ['dan', 'eng'] },
      // Counts as backed up today, so the backup reminder doesn't greet the demo.
      { key: 'lastBackupAt', value: now },
    ],
    series,
    seriesMembers,
  }
  return { data, ranOutAfter }
}
