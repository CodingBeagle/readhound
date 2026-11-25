import type { Author, EditableField, Edition } from './types'

/** The value the app shows: the user's override if there is one, else the source value. */
export function effective<F extends EditableField>(edition: Edition, field: F): Edition[F] {
  const override = edition.overrides[field]
  return (override ?? edition[field]) as Edition[F]
}

/** All editable fields of an edition with overrides applied. */
export function effectiveEdition(edition: Edition): Edition {
  return { ...edition, ...(Object.fromEntries(Object.entries(edition.overrides).filter(([, v]) => v != null)) as Partial<Edition>) }
}

export function effectiveAuthorName(author: Author): string {
  return (author.overrides.name as string | undefined) ?? author.name
}

/** Whether a shown value was borrowed from the work or another edition and not since corrected. */
export function isBorrowed(edition: Edition, field: 'pageCount' | 'coverUrl'): boolean {
  return Boolean(edition.borrowed[field]) && edition.overrides[field] == null
}
