/**
 * Lists, categories, notes, goals and settings: everything the user organises
 * on top of the library itself.
 */
import type { Category, Goal, List, Note } from '@/domain/types'

import { newId, systemClock, type Clock } from './clock'
import type { ReadhoundDB } from './schema'

export interface NoteInput {
  kind: Note['kind']
  text: string
  page?: number
  readId?: string
}

export class CollectionsRepository {
  private readonly db: ReadhoundDB
  private readonly clock: Clock

  constructor(database: ReadhoundDB, clock: Clock = systemClock) {
    this.db = database
    this.clock = clock
  }

  private nowIso() {
    return this.clock.now().toISOString()
  }

  // ---------- Lists ----------

  async createList(name: string, description?: string): Promise<string> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('A list needs a name.')
    const last = await this.db.lists.orderBy('sortOrder').last()
    const list: List = {
      id: newId(),
      name: trimmed,
      description: description?.trim() || undefined,
      createdAt: this.nowIso(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    }
    await this.db.lists.add(list)
    return list.id
  }

  async updateList(listId: string, patch: { name?: string; description?: string }): Promise<void> {
    const name = patch.name?.trim()
    if (patch.name !== undefined && !name) throw new Error('A list needs a name.')
    await this.db.lists.update(listId, {
      ...(name !== undefined && { name }),
      ...(patch.description !== undefined && { description: patch.description.trim() || undefined }),
    })
  }

  /** Deletes the list and its memberships; the books stay in the library. */
  async deleteList(listId: string): Promise<void> {
    await this.db.transaction('rw', [this.db.lists, this.db.listItems], async () => {
      await this.db.listItems.where('listId').equals(listId).delete()
      await this.db.lists.delete(listId)
    })
  }

  /** Moves a list one step up (-1) or down (+1) in the list order. */
  async moveList(listId: string, direction: -1 | 1): Promise<void> {
    await this.db.transaction('rw', this.db.lists, async () => {
      const lists = await this.db.lists.orderBy('sortOrder').toArray()
      const i = lists.findIndex((l) => l.id === listId)
      const j = i + direction
      if (i === -1 || j < 0 || j >= lists.length) return
      ;[lists[i], lists[j]] = [lists[j]!, lists[i]!]
      await this.db.lists.bulkPut(lists.map((l, sortOrder) => ({ ...l, sortOrder })))
    })
  }

  async addToList(listId: string, entryId: string): Promise<void> {
    await this.db.transaction('rw', this.db.listItems, async () => {
      if (await this.db.listItems.get([listId, entryId])) return
      const position = await this.db.listItems.where('listId').equals(listId).count()
      await this.db.listItems.add({ listId, entryId, position, addedAt: this.nowIso() })
    })
  }

  async removeFromList(listId: string, entryId: string): Promise<void> {
    await this.db.listItems.delete([listId, entryId])
  }

  // ---------- Categories ----------

  async createCategory(input: Omit<Category, 'id'>): Promise<string> {
    const name = input.name.trim()
    if (!name) throw new Error('A category needs a name.')
    const category: Category = { ...input, name, id: newId() }
    if (category.kind !== 'genre') delete category.isFiction
    await this.db.categories.add(category)
    return category.id
  }

  async updateCategory(categoryId: string, patch: Partial<Omit<Category, 'id'>>): Promise<void> {
    const current = await this.db.categories.get(categoryId)
    if (!current) return
    const next: Category = { ...current, ...patch, name: (patch.name ?? current.name).trim() }
    if (!next.name) throw new Error('A category needs a name.')
    if (next.kind !== 'genre') delete next.isFiction
    await this.db.categories.put(next)
  }

  /** Deletes the category and removes it from every book. */
  async deleteCategory(categoryId: string): Promise<void> {
    await this.db.transaction('rw', [this.db.categories, this.db.entries], async () => {
      await this.db.entries
        .filter((e) => e.categoryIds.includes(categoryId))
        .modify((e) => {
          e.categoryIds = e.categoryIds.filter((id) => id !== categoryId)
        })
      await this.db.categories.delete(categoryId)
    })
  }

  async toggleCategory(entryId: string, categoryId: string, on: boolean): Promise<void> {
    await this.db.entries
      .where('id')
      .equals(entryId)
      .modify((e) => {
        const without = e.categoryIds.filter((id) => id !== categoryId)
        e.categoryIds = on ? [...without, categoryId] : without
      })
  }

  // ---------- Notes and quotes ----------

  async addNote(entryId: string, input: NoteInput): Promise<string> {
    const text = input.text.trim()
    if (!text) throw new Error('A note needs some text.')
    const now = this.nowIso()
    const note: Note = { id: newId(), entryId, kind: input.kind, text, page: input.page, readId: input.readId, createdAt: now, updatedAt: now }
    await this.db.notes.add(note)
    return note.id
  }

  async updateNote(noteId: string, input: Partial<NoteInput>): Promise<void> {
    const text = input.text?.trim()
    if (input.text !== undefined && !text) throw new Error('A note needs some text.')
    const updatedAt = this.nowIso()
    await this.db.notes
      .where('id')
      .equals(noteId)
      .modify((note) => {
        if (input.kind) note.kind = input.kind
        if (text !== undefined) note.text = text
        if ('page' in input) {
          if (input.page === undefined) delete note.page
          else note.page = input.page
        }
        note.updatedAt = updatedAt
      })
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.db.notes.delete(noteId)
  }

  // ---------- Goals and settings ----------

  /** Sets the reading goal for a year; clearing both targets removes the goal. */
  async setGoal(goal: Goal): Promise<void> {
    if (goal.targetBooks === undefined && goal.targetPages === undefined) await this.db.goals.delete(goal.year)
    else await this.db.goals.put(goal)
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.db.settings.put({ key, value })
  }
}
