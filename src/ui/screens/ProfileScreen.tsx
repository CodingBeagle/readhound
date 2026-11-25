import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import { useServices } from '@/app/services'
import { backupCounts, BackupError, parseBackup, restoreBackup, SETTING_PREFERRED_LANGUAGES, type Backup } from '@/db/backup'
import { getSetting } from '@/db/queries'
import { DEFAULT_PREFERRED_LANGUAGES } from '@/domain/editions'
import type { Category } from '@/domain/types'
import { t } from '@/i18n'
import { Button } from '@/ui/components/ui/button'
import { Field, Input, Select } from '@/ui/components/ui/input'
import { useBackup } from '@/ui/hooks/useBackup'
import { useCollections } from '@/ui/hooks/useCollections'
import { ScreenHeader } from '@/ui/layout/ScreenHeader'
import { DangerZone } from '@/ui/profile/DangerZone'
import { LevelCard } from '@/ui/achievements/LevelCard'
import { useAchievements } from '@/ui/achievements/useAchievements'
import { Section } from '@/ui/layout/Section'
import { ThemePicker } from '@/ui/theme/ThemePicker'

const p = t.screens.profile

/** Appearance, goals, lists, categories, preferred languages, export/import and the danger zone (design doc, Screens). */
export function ProfileScreen() {
  return (
    <>
      <ScreenHeader title={p.title} />
      <Section title={p.appearance.title}>
        <p className="mb-3 text-sm text-muted-foreground">{p.appearance.intro}</p>
        <ThemePicker />
      </Section>
      <AchievementsSection />
      <BackupSection />
      <GoalSection />
      <ListsSection />
      <CategoriesSection />
      <LanguagesSection />
      <Section title={p.demo.title}>
        <p className="mb-3 text-sm text-muted-foreground">{p.demo.intro}</p>
        <Button asChild variant="outline">
          <Link to="/demo">{p.demo.open}</Link>
        </Button>
      </Section>
      <Section title={p.about.title}>
        <p className="text-sm text-muted-foreground">{p.about.version(__APP_VERSION__)}</p>
      </Section>
      <DangerZone />
    </>
  )
}

function AchievementsSection() {
  const summary = useAchievements()
  if (!summary) return null
  return (
    <Section title={t.achievements.title}>
      <LevelCard summary={summary} />
    </Section>
  )
}

function Status({ children }: { children?: string }) {
  return (
    <p role="status" className="min-h-4 text-xs text-muted-foreground">
      {children}
    </p>
  )
}

// ---------- Backup ----------

function BackupSection() {
  const { db } = useServices()
  const backup = useBackup()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup>()
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()

  async function pick(file: File | undefined) {
    setError(undefined)
    setMessage(undefined)
    setPending(undefined)
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
    } catch (e) {
      setError(e instanceof BackupError ? e.message : String(e))
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function confirmImport() {
    if (!pending) return
    await restoreBackup(db, pending)
    setPending(undefined)
    setMessage(p.backup.imported)
  }

  const last = backup.lastBackupAt ? new Date(backup.lastBackupAt).toLocaleDateString() : undefined

  return (
    <Section title={p.backup.title}>
      <div className="flex flex-col gap-4 surface p-4">
        <p className="text-sm">{p.backup.intro}</p>
        <p className={backup.due ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>{last ? p.backup.lastBackup(last) : p.backup.never}</p>

        <div className="flex flex-col gap-1.5">
          <Button
            onClick={async () => {
              await backup.exportJson()
              setMessage(p.backup.exported)
            }}
          >
            {p.backup.exportJson}
          </Button>
          <p className="text-xs text-muted-foreground">{p.backup.exportJsonHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{p.backup.exportCsv}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void backup.exportLibraryCsv()}>
              {p.backup.libraryCsv}
            </Button>
            <Button variant="outline" onClick={() => void backup.exportReadsCsv()}>
              {p.backup.readsCsv}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-4">
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            {p.backup.importJson}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label={p.backup.importJson}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <p className="text-xs text-muted-foreground">{p.backup.importHint}</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {pending && (
            <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
              <p>{p.backup.importSummary(backupCounts(pending))}</p>
              <p className="font-medium">{p.backup.importWarning}</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => void confirmImport()}>
                  {p.backup.importConfirm}
                </Button>
                <Button variant="ghost" onClick={() => setPending(undefined)}>
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          )}
        </div>
        <Status>{message}</Status>
      </div>
    </Section>
  )
}

// ---------- Goal ----------

const toNumber = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.round(Number(v))))

function GoalSection() {
  const { db, clock } = useServices()
  const year = clock.now().getFullYear()
  const goal = useLiveQuery(async () => (await db.goals.get(year)) ?? null, [db, year])
  // Lives here so it survives the form re-mounting after a save.
  const [message, setMessage] = useState<string>()
  if (goal === undefined) return null
  // Re-mount the form when the stored goal changes (e.g. after an import).
  return <GoalForm key={JSON.stringify(goal)} year={year} books={goal?.targetBooks} pages={goal?.targetPages} message={message} setMessage={setMessage} />
}

function GoalForm({
  year,
  books,
  pages,
  message,
  setMessage,
}: {
  year: number
  books?: number
  pages?: number
  message?: string
  setMessage: (m: string) => void
}) {
  const { collections } = useServices()
  const [form, setForm] = useState({ books: books?.toString() ?? '', pages: pages?.toString() ?? '' })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await collections.setGoal({ year, targetBooks: toNumber(form.books) || undefined, targetPages: toNumber(form.pages) || undefined })
    setMessage(p.goal.saved)
  }

  return (
    <Section title={p.goal.title(year)}>
      <form onSubmit={save} className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label={p.goal.books}>
            <Input inputMode="numeric" value={form.books} onChange={(e) => setForm({ ...form, books: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label={p.goal.pages}>
            <Input inputMode="numeric" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Button type="submit">{t.common.save}</Button>
        </div>
        <Status>{message ?? p.goal.hint}</Status>
      </form>
    </Section>
  )
}

// ---------- Lists ----------

function ListsSection() {
  const { collections } = useServices()
  const data = useCollections()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string>()
  const [deleting, setDeleting] = useState<string>()

  if (!data) return null
  const counts = new Map<string, number>()
  for (const item of data.listItems) counts.set(item.listId, (counts.get(item.listId) ?? 0) + 1)

  return (
    <Section title={p.lists.title}>
      <p className="mb-3 text-sm text-muted-foreground">{p.lists.intro}</p>
      {data.lists.length === 0 && <p className="mb-3 text-sm">{p.lists.empty}</p>}
      <ul className="mb-3 flex flex-col divide-y surface">
        {data.lists.map((list, i) => (
          <li key={list.id} className="flex flex-col gap-2 px-3 py-1">
            {editing === list.id ? (
              <RenameForm
                label={p.lists.name}
                initial={list.name}
                onCancel={() => setEditing(undefined)}
                onSave={async (value) => {
                  await collections.updateList(list.id, { name: value })
                  setEditing(undefined)
                }}
              />
            ) : (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{list.name}</p>
                  <p className="text-xs text-muted-foreground">{p.lists.count(counts.get(list.id) ?? 0)}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={p.lists.moveUp(list.name)} disabled={i === 0} onClick={() => void collections.moveList(list.id, -1)}>
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={p.lists.moveDown(list.name)}
                  disabled={i === data.lists.length - 1}
                  onClick={() => void collections.moveList(list.id, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon" aria-label={p.lists.rename(list.name)} onClick={() => setEditing(list.id)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon" aria-label={p.lists.remove(list.name)} onClick={() => setDeleting(list.id)}>
                  <Trash2 />
                </Button>
              </div>
            )}
            {deleting === list.id && (
              <ConfirmDelete text={p.lists.confirmDelete} onCancel={() => setDeleting(undefined)} onConfirm={() => collections.deleteList(list.id)} />
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await collections.createList(name)
          setName('')
        }}
      >
        <Field label={p.lists.name} className="flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" disabled={!name.trim()}>
          {p.lists.add}
        </Button>
      </form>
    </Section>
  )
}

function RenameForm({ label, initial, onSave, onCancel }: { label: string; initial: string; onSave: (value: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(initial)
  return (
    <form
      className="flex items-end gap-2 py-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) void onSave(value)
      }}
    >
      <Field label={label} className="flex-1">
        <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
      <Button type="submit" disabled={!value.trim()}>
        {t.common.save}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {t.common.cancel}
      </Button>
    </form>
  )
}

function ConfirmDelete({ text, onConfirm, onCancel }: { text: string; onConfirm: () => Promise<void>; onCancel: () => void }) {
  return (
    <div className="mb-2 flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
      <p>{text}</p>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={() => void onConfirm()}>
          {t.common.delete}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  )
}

// ---------- Categories ----------

type CategoryDraft = Omit<Category, 'id'>
type FictionChoice = keyof typeof p.categories.fictionOptions

const fictionChoice = (c: CategoryDraft): FictionChoice => (c.isFiction === undefined ? 'unset' : c.isFiction ? 'fiction' : 'nonfiction')
const fromChoice = (choice: FictionChoice) => (choice === 'unset' ? undefined : choice === 'fiction')

function CategoriesSection() {
  const { collections } = useServices()
  const data = useCollections()
  const [editing, setEditing] = useState<string>()
  const [deleting, setDeleting] = useState<string>()
  const [formKey, setFormKey] = useState(0)

  if (!data) return null
  return (
    <Section title={p.categories.title}>
      <p className="mb-3 text-sm text-muted-foreground">{p.categories.intro}</p>
      {data.categories.length === 0 && <p className="mb-3 text-sm">{p.categories.empty}</p>}
      <ul className="mb-3 flex flex-col divide-y surface">
        {data.categories.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 px-3 py-1">
            {editing === c.id ? (
              <CategoryForm
                initial={c}
                submitLabel={t.common.save}
                onCancel={() => setEditing(undefined)}
                onSubmit={async (draft) => {
                  await collections.updateCategory(c.id, draft)
                  setEditing(undefined)
                }}
              />
            ) : (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.categories.kinds[c.kind], c.kind === 'genre' && c.isFiction !== undefined && p.categories.fictionOptions[fictionChoice(c)]]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label={p.categories.edit(c.name)} onClick={() => setEditing(c.id)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon" aria-label={p.categories.remove(c.name)} onClick={() => setDeleting(c.id)}>
                  <Trash2 />
                </Button>
              </div>
            )}
            {deleting === c.id && (
              <ConfirmDelete text={p.categories.confirmDelete} onCancel={() => setDeleting(undefined)} onConfirm={() => collections.deleteCategory(c.id)} />
            )}
          </li>
        ))}
      </ul>
      <CategoryForm
        key={formKey}
        initial={{ name: '', kind: 'genre' }}
        submitLabel={p.categories.add}
        onSubmit={async (draft) => {
          await collections.createCategory(draft)
          setFormKey((k) => k + 1)
        }}
      />
    </Section>
  )
}

function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: CategoryDraft
  submitLabel: string
  onSubmit: (draft: CategoryDraft) => Promise<void>
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState<CategoryDraft>({ name: initial.name, kind: initial.kind, isFiction: initial.isFiction })
  return (
    <form
      className="flex flex-col gap-2 py-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.name.trim()) void onSubmit(draft)
      }}
    >
      <Field label={p.categories.name}>
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={p.categories.kind}>
          <Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Category['kind'] })}>
            {(['genre', 'shelf'] as const).map((k) => (
              <option key={k} value={k}>
                {p.categories.kinds[k]}
              </option>
            ))}
          </Select>
        </Field>
        {draft.kind === 'genre' && (
          <Field label={p.categories.fiction}>
            <Select value={fictionChoice(draft)} onChange={(e) => setDraft({ ...draft, isFiction: fromChoice(e.target.value as FictionChoice) })}>
              {(Object.keys(p.categories.fictionOptions) as FictionChoice[]).map((k) => (
                <option key={k} value={k}>
                  {p.categories.fictionOptions[k]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!draft.name.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
      </div>
    </form>
  )
}

// ---------- Preferred languages ----------

function LanguagesSection() {
  const { db } = useServices()
  const languages = useLiveQuery(() => getSetting(db, SETTING_PREFERRED_LANGUAGES, DEFAULT_PREFERRED_LANGUAGES), [db])
  const [message, setMessage] = useState<string>()
  if (!languages) return null
  return <LanguagesForm key={languages.join()} initial={languages} message={message} setMessage={setMessage} />
}

function LanguagesForm({ initial, message, setMessage }: { initial: string[]; message?: string; setMessage: (m: string) => void }) {
  const { collections } = useServices()
  const [value, setValue] = useState(initial.join(', '))
  return (
    <Section title={p.languages.title}>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const codes = [...new Set(value.toLowerCase().split(/[\s,]+/).filter((c) => /^[a-z]{2,3}$/.test(c)))]
          await collections.setSetting(SETTING_PREFERRED_LANGUAGES, codes.length ? codes : DEFAULT_PREFERRED_LANGUAGES)
          setMessage(p.languages.saved)
        }}
      >
        <div className="flex items-end gap-2">
          <Field label={p.languages.title} className="flex-1">
            <Input value={value} onChange={(e) => setValue(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          </Field>
          <Button type="submit">{t.common.save}</Button>
        </div>
        <Status>{message ?? p.languages.hint}</Status>
      </form>
    </Section>
  )
}
