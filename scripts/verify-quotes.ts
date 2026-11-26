/**
 * Checks every quote in src/domain/quoteData.ts word for word against the full
 * text of its book, so no misquote or misattribution slips in. The texts come
 * from GITenberg, the Project Gutenberg mirror on GitHub, and are cached in
 * node_modules/.cache. Run with `npm run verify-quotes` after adding quotes.
 *
 * Matching ignores case, line breaks, italics markers, quotation marks and the
 * spelling of dashes, but every word and other punctuation mark must be there.
 * A quote with ‘…’ must have its parts in order, close together.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { QUOTE_DATA } from '../src/domain/quoteData.ts'

/** Gutenberg ebook number → path of its plain text on raw.githubusercontent.com/GITenberg. */
const SOURCES: Record<number, string> = {
  11: 'Alice-s-Adventures-in-Wonderland_11/master/11.txt',
  12: 'Through-the-Looking-Glass_12/master/12.txt',
  16: 'Peter-Pan_16/master/16.txt',
  28: 'Aesop-s-Fables_28/master/28.txt',
  33: 'The-Scarlet-Letter_33/master/33.txt',
  42: 'The-Strange-Case-of-Dr.-Jekyll-and-Mr.-Hyde_42/master/42.txt',
  45: 'Anne-of-Green-Gables_45/master/45.txt',
  46: 'A-Christmas-Carol_46/master/46.txt',
  55: 'The-Wonderful-Wizard-of-Oz_55/master/55.txt',
  74: 'The-Adventures-of-Tom-Sawyer_74/master/74.txt',
  76: 'Adventures-of-Huckleberry-Finn_76/master/76.txt',
  84: 'Frankenstein_84/master/84.txt',
  98: 'A-Tale-of-Two-Cities_98/master/98.txt',
  102: 'The-Tragedy-of-Pudd-nhead-Wilson_102/master/102.txt',
  105: 'Persuasion_105/master/105.txt',
  107: 'Far-from-the-Madding-Crowd_107/master/107.txt',
  113: 'The-Secret-Garden_113/master/113.txt',
  120: 'Treasure-Island_120/master/120.txt',
  121: 'Northanger-Abbey_121/master/121.txt',
  135: 'Les-Mis-rables_135/master/135.txt',
  141: 'Mansfield-Park_141/master/141.txt',
  145: 'Middlemarch_145/master/145.txt',
  146: 'A-Little-Princess--13-Being-the-whole-story-of-Sara-Crewe-now-told-for-the-first-time_146/master/146.txt',
  158: 'Emma_158/master/158.txt',
  161: 'Sense-and-Sensibility_161/master/161.txt',
  174: 'The-Picture-of-Dorian-Gray_174/master/174.txt',
  205: 'Walden-and-On-The-Duty-Of-Civil-Disobedience_205/master/205.txt',
  215: 'The-Call-of-the-Wild_215/master/215.txt',
  219: 'Heart-of-Darkness_219/master/219.txt',
  236: 'The-Jungle-Book_236/master/236.txt',
  271: 'Black-Beauty_271/master/271.txt',
  289: 'The-Wind-in-the-Willows_289/master/289.txt',
  345: 'Dracula_345/master/345.txt',
  514: 'Little-Women_514/master/514.txt',
  521: 'The-Life-and-Adventures-of-Robinson-Crusoe_521/master/521.txt',
  550: 'Silas-Marner_550/master/550.txt',
  730: 'Oliver-Twist_730/master/730.txt',
  766: 'David-Copperfield_766/master/766.txt',
  768: 'Wuthering-Heights_768/master/768.txt',
  790: 'Lady-Windermere-s-Fan_790/master/790-0.txt',
  829: 'Gulliver-s-Travels_829/master/829.txt',
  844: 'The-Importance-of-Being-Earnest--A-Trivial-Comedy-for-Serious-People_844/master/844.txt',
  885: 'An-Ideal-Husband_885/master/885.txt',
  902: 'The-Happy-Prince-and-Other-Tales_902/master/902-0.txt',
  910: 'White-Fang_910/master/910.txt',
  996: 'Don-Quixote_996/master/996.txt',
  1023: 'Bleak-House_1023/master/1023.txt',
  1041: 'Shakespeare-s-Sonnets_1041/master/1041.txt',
  1121: 'As-You-Like-It_1121/master/1121.txt',
  1184: 'The-Count-of-Monte-Cristo_1184/master/1184.txt',
  1257: 'The-Three-Musketeers_1257/master/1257.txt',
  1260: 'Jane-Eyre_1260/master/1260.txt',
  1322: 'Leaves-of-Grass_1322/master/1322.txt',
  1342: 'Pride-and-Prejudice_1342/master/1342.txt',
  1399: 'Anna-Karenina_1399/master/1399.txt',
  1400: 'Great-Expectations_1400/master/1400.txt',
  1513: 'Romeo-and-Juliet_1513/master/1513.txt',
  1514: 'A-Midsummer-Night-s-Dream_1514/master/1514.txt',
  1515: 'The-Merchant-of-Venice_1515/master/1515.txt',
  1522: 'Julius-Caesar_1522/master/1522.txt',
  1524: 'Hamlet-Prince-of-Denmark_1524/master/1524.txt',
  1526: 'Twelfth-Night-Or-What-You-Will_1526/master/1526.txt',
  1533: 'Macbeth_1533/master/1533.txt',
  1661: 'The-Adventures-of-Sherlock-Holmes_1661/master/1661.txt',
  2554: 'Crime-and-Punishment_2554/master/2554.txt',
  2600: 'War-and-Peace_2600/master/2600.txt',
  2680: 'Meditations_2680/master/2680.txt',
  2701: 'Moby-Dick--Or-The-Whale_2701/master/2701.txt',
  2852: 'The-Hound-of-the-Baskervilles_2852/master/2852.txt',
  2895: 'Following-the-Equator--A-Journey-Around-the-World_2895/master/2895.txt',
  2944: 'Essays---First-Series_2944/master/2944.txt',
  6688: 'The-Mill-on-the-Floss_6688/master/6688.txt',
  7164: 'Gitanjali_7164/master/7164.txt',
  11757: 'The-Velveteen-Rabbit_11757/master/11757.txt',
  12242: 'Poems-by-Emily-Dickinson-Three-Series-Complete_12242/master/12242.txt',
  23042: 'The-TempestThe-Works-of-William-Shakespeare--Cambridge-Edition---9-vols.-_23042/master/23042.txt',
  28054: 'The-Brothers-Karamazov_28054/master/28054.txt',
  45109: 'The-Enchiridion_45109/master/45109.txt',
  58585: 'The-Prophet_58585/master/58585-0.txt',
  64317: 'The-Great-Gatsby_64317/master/64317-0.txt',
  70950: 'In-memoriam_70950/master/70950-0.txt',
}

const CACHE = new URL('../node_modules/.cache/readhound-quotes/', import.meta.url)

/** Folds the text for matching: see the comment at the top. */
export function fold(text: string): string {
  return text
    .replace(/_/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/["“”]/g, ' ')
    .replace(/(?<![A-Za-z])'|'(?![A-Za-z])/g, ' ')
    .replace(/\s*(--|—|–)\s*/g, '—')
    .replace(/\s*([,;:])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

async function bookText(gutenberg: number): Promise<string> {
  const file = new URL(`${gutenberg}.txt`, CACHE)
  try {
    return await readFile(file, 'utf8')
  } catch {
    const path = SOURCES[gutenberg]
    if (!path) throw new Error(`No source text listed for Gutenberg #${gutenberg}: add it to SOURCES.`)
    const response = await fetch(`https://raw.githubusercontent.com/GITenberg/${path}`)
    if (!response.ok) throw new Error(`Could not fetch Gutenberg #${gutenberg}: HTTP ${response.status}`)
    const text = await response.text()
    await mkdir(CACHE, { recursive: true })
    await writeFile(file, text)
    return text
  }
}

/** True when the quote is in the text, with its ‘…’ parts in order and at most 800 characters apart. */
export function quoteIsIn(quote: string, text: string): boolean {
  const parts = fold(quote)
    .split('…')
    .map((p) => p.trim().replace(/^[,.;]\s*/, '').replace(/[.!?,;:]+$/, ''))
    .filter(Boolean)
  let at = text.indexOf(parts[0]!)
  if (at < 0) return false
  at += parts[0]!.length
  for (const part of parts.slice(1)) {
    const next = text.indexOf(part, at)
    if (next < 0 || next - at > 800) return false
    at = next + part.length
  }
  return true
}

const folded = new Map<number, string>()
const failures: string[] = []
for (const quote of QUOTE_DATA.quotes) {
  const book = QUOTE_DATA.books[quote.book]
  if (!book) {
    failures.push(`${quote.id}: unknown book ${quote.book}`)
    continue
  }
  if (!folded.has(book.gutenberg)) folded.set(book.gutenberg, fold(await bookText(book.gutenberg)))
  if (!quoteIsIn(quote.text, folded.get(book.gutenberg)!)) failures.push(`${quote.id} (${book.title}): ${quote.text}`)
}

if (failures.length) {
  console.error(`${failures.length} of ${QUOTE_DATA.quotes.length} quotes are not in their book's text:\n` + failures.join('\n'))
  process.exit(1)
}
console.log(`All ${QUOTE_DATA.quotes.length} quotes found word for word in their ${folded.size} books.`)
