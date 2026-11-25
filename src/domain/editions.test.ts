import { foldText } from './bookView'
import { orderEditions } from './editions'
import type { EditionDetails } from '@/sources/types'

const ed = (id: string, language?: string, publishYear?: number) =>
  ({ edition: { source: 'openlibrary', id }, title: id, authors: [], publishers: [], isbn10: [], isbn13: [], language, publishYear }) as unknown as EditionDetails

describe('orderEditions', () => {
  it('puts preferred languages first in preference order, then newest first', () => {
    const ordered = orderEditions([ed('nl', 'dut', 2020), ed('en-old', 'eng', 1990), ed('da', 'dan', 1992), ed('en-new', 'eng', 2010), ed('none')], ['dan', 'eng'])
    expect(ordered.map((e) => e.title)).toEqual(['da', 'en-new', 'en-old', 'nl', 'none'])
  })
})

describe('foldText', () => {
  it('folds Danish letters and accents so "hoeg" finds "Høeg"', () => {
    expect(foldText('Frøken Smilla, Peter Høeg')).toBe('froken smilla, peter hoeg')
    expect(foldText('Ærø Århus Brontë')).toBe('aero arhus bronte')
  })
})
