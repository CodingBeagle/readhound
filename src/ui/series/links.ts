import type { SeriesMemberView } from '@/domain/series'

/** Where to look for a book of the series that isn't in the library: its catalog page, or a search. */
export function findLink(member: SeriesMemberView): string {
  if (member.member.olWorkId) return `/search/work/${member.member.olWorkId}`
  return `/search?q=${encodeURIComponent([member.title, member.member.authorName].filter(Boolean).join(' '))}`
}
