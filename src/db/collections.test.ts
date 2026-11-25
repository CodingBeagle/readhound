import 'fake-indexeddb/auto'

import { loadLibrary } from './queries'
import type { Clock } from './clock'
import { CollectionsRepository } from './collections'
import { LibraryRepository } from './library'
import { ReadhoundDB } from './schema'

const clock: Clock = { now: () => new Date('2026-11-25T09:00:00Z'), timeZone: () => 'Europe/Copenhagen' }
let db: ReadhoundDB
let library: LibraryRepository
let repo: CollectionsRepository

beforeEach(async () => {
  db = new ReadhoundDB(`test-${crypto.randomUUID()}`)
  await db.open()
  library = new LibraryRepository(db, clock)
  repo = new CollectionsRepository(db, clock)
})
afterEach(async () => {
  await db.delete()
})

const addBook = async (title: string, listIds?: string[]) => (await library.addManual({ title, authors: ['X'] }, { listIds })).entryId

describe('lists', () => {
  it('creates lists in order and moves them', async () => {
    const a = await repo.createList('  Summer 2027 ')
    const b = await repo.createList('Danish classics')
    await repo.moveList(b, -1)
    const lists = await db.lists.orderBy('sortOrder').toArray()
    expect(lists.map((l) => l.name)).toEqual(['Danish classics', 'Summer 2027'])
    await repo.moveList(a, 1) // already last: no change
    expect((await db.lists.orderBy('sortOrder').toArray()).map((l) => l.id)).toEqual([b, a])
  })

  it('rejects an empty name', async () => {
    await expect(repo.createList('  ')).rejects.toThrow()
  })

  it('appends books at the end of a list, ignores duplicates, and keeps books when the list is deleted', async () => {
    const list = await repo.createList('Holiday')
    const one = await addBook('One', [list])
    const two = await addBook('Two')
    await repo.addToList(list, two)
    await repo.addToList(list, two)
    const items = await db.listItems.where('listId').equals(list).sortBy('position')
    expect(items.map((i) => [i.entryId, i.position])).toEqual([
      [one, 0],
      [two, 1],
    ])
    await repo.removeFromList(list, one)
    expect(await db.listItems.count()).toBe(1)
    await repo.deleteList(list)
    expect(await db.listItems.count()).toBe(0)
    expect(await db.entries.count()).toBe(2)
  })
})

describe('categories', () => {
  it('only genres carry the fiction flag', async () => {
    const id = await repo.createCategory({ name: 'Favourites', kind: 'shelf', isFiction: true })
    expect((await db.categories.get(id))?.isFiction).toBeUndefined()
    await repo.updateCategory(id, { kind: 'genre', isFiction: false })
    expect(await db.categories.get(id)).toMatchObject({ kind: 'genre', isFiction: false })
  })

  it('toggles a category on a book and removes it from books when deleted', async () => {
    const crime = await repo.createCategory({ name: 'Crime', kind: 'genre', isFiction: true })
    const entry = await addBook('Book')
    await repo.toggleCategory(entry, crime, true)
    await repo.toggleCategory(entry, crime, true)
    expect((await db.entries.get(entry))?.categoryIds).toEqual([crime])
    await repo.deleteCategory(crime)
    expect((await db.entries.get(entry))?.categoryIds).toEqual([])
    expect(await db.categories.count()).toBe(0)
  })
})

describe('notes', () => {
  it('adds, edits and deletes notes and quotes', async () => {
    const entry = await addBook('Book')
    const id = await repo.addNote(entry, { kind: 'quote', text: ' To be or not ', page: 12 })
    expect(await db.notes.get(id)).toMatchObject({ kind: 'quote', text: 'To be or not', page: 12 })
    await repo.updateNote(id, { text: 'Edited', page: undefined })
    const edited = await db.notes.get(id)
    expect(edited?.text).toBe('Edited')
    expect(edited).not.toHaveProperty('page')
    await expect(repo.addNote(entry, { kind: 'note', text: ' ' })).rejects.toThrow()
    await library.deleteEntry(entry)
    expect(await db.notes.count()).toBe(0)
  })
})

describe('goals', () => {
  it('stores a yearly goal and removes it when both targets are cleared', async () => {
    await repo.setGoal({ year: 2027, targetBooks: 30 })
    expect(await db.goals.get(2027)).toEqual({ year: 2027, targetBooks: 30 })
    await repo.setGoal({ year: 2027 })
    expect(await db.goals.count()).toBe(0)
  })
})

it('library rows reflect categories for filtering', async () => {
  const cat = await repo.createCategory({ name: 'Crime', kind: 'genre' })
  const entry = await addBook('Book')
  await repo.toggleCategory(entry, cat, true)
  const [book] = await loadLibrary(db)
  expect(book?.entry.categoryIds).toEqual([cat])
})
