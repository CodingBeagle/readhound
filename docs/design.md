# Readhound: book reading app design

Nov 25, 2026 · @Kasper

This is the living design document for the app and the specification to implement it from. It is written so a developer or coding agent can build version 1 without further context. Everything outside **Open questions** is decided. Technical details I filled in without an explicit decision (debounce times, cache lifetimes, length buckets, the rating scale) are reasonable defaults and can be changed. The tech stack and local-only storage are decided; see those sections.

## Overview

**Name:** Readhound. Use it for the app title, PWA manifest name, and the Open Library User-Agent (`Readhound/<version> (<contact email>)`).

**Goal:** a personal app for tracking the books I'm currently reading, organizing books into categories, and showing many kinds of statistics about my reading.

**Users:** one person to begin with (personal use).

**Platform:** cross-platform in the long run (mobile and web). Version 1 is a web app designed mobile-first, so it works well on a phone screen and scales up to desktop.

**Principle:** books come from an external catalog of published books wherever possible. Typing a book in by hand is the last resort.

## Book sources

**Version 1:** Open Library is the only catalog source. Manual entry is the fallback when a book can't be found. Research on Open Library is in [Open Library as the book source](https://claude.ai/artifact/WG6Pa1EW1f3ftdJyUUQk5s).

**Extensibility:** each catalog is an adapter behind one shared interface, so more sources (such as Google Books) can be added later as extra fallbacks without changing the rest of the app. Each adapter can:

- search by free text (title, author or both)
- look up a book by ISBN
- fetch full details for an edition and its work
- return results in the app's own book format, tagged with the source name and the source's ID

**Lookup order:** the app asks each configured source in priority order and shows results from the first one that returns matches. If nothing is found, it offers manual entry, prefilled with what the user already typed.

**Open Library rules to respect:**

- send a User-Agent naming the app and a contact email (raises the limit from 1 to 3 requests per second)
- only make requests on behalf of a person using the app, and cache what comes back
- load covers by cover ID from covers.openlibrary.org (loading by ISBN is limited to 100 per 5 minutes)
- debounce search-as-you-type, show a loading state, and retry once, since searches can take several seconds
- filter obvious noise such as "Summary of…" books, and rank results by edition count

### Source adapter interface

Types are written in TypeScript notation for precision; the tech stack is still open, so translate as needed.

```ts
type SourceId = "openlibrary" | "manual";   // extend with "googlebooks" etc. later

interface SourceRef { source: SourceId; id: string }   // e.g. { source: "openlibrary", id: "OL21745884W" }

interface SearchQuery { text?: string; title?: string; author?: string; isbn?: string; limit?: number }

interface SearchResult {          // one per work
  work: SourceRef;
  title: string;
  authors: { ref: SourceRef; name: string }[];
  firstPublishYear?: number;
  editionCount: number;
  medianPageCount?: number;
  coverUrl?: string;
  languages: string[];            // ISO 639-2/B codes, e.g. "dan", "eng"
}

interface EditionDetails {
  edition: SourceRef; work: SourceRef;
  title: string; subtitle?: string;
  authors: { ref: SourceRef; name: string }[];
  isbn10: string[]; isbn13: string[];
  publishers: string[]; publishDate?: string;   // raw string from source
  publishYear?: number;                          // parsed
  pageCount?: number; language?: string; format?: string;
  coverUrl?: string; subjects: string[]; description?: string;
}

interface BookSource {
  id: SourceId;
  search(q: SearchQuery, signal?: AbortSignal): Promise<SearchResult[]>;
  listEditions(work: SourceRef, opts?: { language?: string; limit?: number; offset?: number }): Promise<EditionDetails[]>;
  getEdition(edition: SourceRef): Promise<EditionDetails | null>;
  lookupIsbn(isbn: string): Promise<EditionDetails | null>;
  getWork(work: SourceRef): Promise<{ description?: string; subjects: string[] } | null>;
}
```

A `SourceRegistry` holds the adapters in priority order (version 1: `[OpenLibrarySource]`). The UI only talks to the registry, never to an adapter directly.

### Open Library adapter

| Operation | Endpoint |
| --- | --- |
| Search | `GET https://openlibrary.org/search.json?q=…` (or `title=` / `author=`) with `fields=key,title,author_name,author_key,first_publish_year,edition_count,language,number_of_pages_median,cover_i&limit=20` |
| Editions of a work | `GET https://openlibrary.org/works/{OLID}/editions.json?limit=50&offset=…` |
| Edition | `GET https://openlibrary.org/books/{OLID}.json` |
| ISBN lookup | `GET https://openlibrary.org/isbn/{isbn}.json` (404 means not found) |
| Work | `GET https://openlibrary.org/works/{OLID}.json` |
| Cover image | `https://covers.openlibrary.org/b/id/{cover_id}-{size}.jpg`, where size is `S`, `M` or `L` |

**Field mapping notes:**

- `key` values look like `/works/OL21745884W`; store only the OLID part as `SourceRef.id`.
- Edition `languages` is `[{key:"/languages/dan"}]`; map to `"dan"`. It is often missing.
- Work `description` can be a string or `{type, value}`; normalise to a string.
- Edition `covers` is an array of cover IDs; use the first positive value. Search uses `cover_i`.
- `publish_date` is free text ("May 04, 2021", "2015-12-11", "2000"); parse the first 4-digit year into `publishYear`.
- Work `first_publish_year` is unreliable for older Danish books; show it, but let the user override.

**Behaviour:**

- Every request sends `User-Agent: <AppName>/<version> (<contact email>)`; app name and email are configuration values. Exception: browsers can't send a custom User-Agent to Open Library (its CORS preflight rejects the header), so the web app sends none and throttles itself to the unidentified limit of 1 request per second; the header and 3 requests per second apply only outside the browser (tests, a future native Capacitor HTTP layer).
- Client-side throttle: at most 3 requests per second; on HTTP 429 or a dropped connection, wait 1 second and retry once.
- Search input is debounced by 400 ms, and an in-flight search is cancelled when the query changes.
- Timeout 15 seconds per request; show a loading state after 300 ms.
- Result filtering: drop works whose title starts with "Summary of", "Summary and Analysis", "Study Guide" or "SUMMARY" (case-insensitive). Sort by relevance as returned, then by `edition_count` as a tie-breaker.
- Cache search responses for 24 hours and edition and work responses for 30 days, keyed by URL.
- Typing a valid ISBN-10 or ISBN-13 (hyphens and spaces stripped, checksum valid) into search runs `lookupIsbn` first.

## Data model

**Edition-first:** a book in the library is the specific edition the user owns, because page tracking and notes depend on the exact copy. Each edition links to its work (the book in general) for grouping editions and finding other books by the same author.

### Schema

All IDs are UUIDs generated by the app. All timestamps are stored in UTC (ISO 8601); calendar dates are stored as `YYYY-MM-DD` in the user's local time zone. `?` marks optional fields.

```ts
interface Work {
  id: string;
  sourceRef?: SourceRef;              // absent for manual works
  title: string;
  authorIds: string[];                // ordered
  firstPublishYear?: number;
  originalLanguage?: string;          // ISO 639-2/B, often user-supplied
  subjects: string[];                 // raw source subjects, suggestions only
  description?: string;
  medianPageCount?: number;
  fetchedAt?: string;
}

interface Edition {
  id: string;
  workId: string;
  sourceRef?: SourceRef;
  title: string; subtitle?: string;
  isbn13?: string; isbn10?: string;
  publisher?: string;
  publishYear?: number;
  pageCount?: number;
  language?: string;                  // language of this edition
  format?: "hardcover" | "paperback" | "ebook" | "audiobook" | "other";
  coverUrl?: string;                  // remote URL or local blob reference
  borrowed: { pageCount?: boolean; coverUrl?: boolean };  // value taken from work or another edition
  overrides: Partial<Record<EditableField, unknown>>;   // user edits, win over source values
  fetchedAt?: string;
}

interface Author {
  id: string;
  sourceRef?: SourceRef;
  name: string;
  country?: string;                   // ISO 3166-1 alpha-2, for the map stat
  wikidataId?: string;
  overrides: Partial<Record<"name" | "country", unknown>>;
}

type Status = "to_read" | "reading" | "finished" | "dnf";

interface LibraryEntry {              // my copy of one edition; unique per editionId
  id: string;
  editionId: string;
  status: Status;
  addedAt: string;
  statusChangedAt: string;
  rating?: number;                    // scale open; store as 0.5–5 in 0.5 steps unless decided otherwise
  categoryIds: string[];
  favourite: boolean;
}

interface Read {                      // one attempt at reading the book
  id: string;
  entryId: string;
  startedOn: string;                  // date
  endedOn?: string;                   // date, set when finished or DNF
  outcome?: "finished" | "dnf";       // absent while in progress
  stoppedAtPage?: number;             // for DNF
}

interface ReadingSession {
  id: string;
  readId: string;
  startedAt: string;                  // timestamp
  durationMinutes?: number;
  fromPage: number;                   // page reached before the session
  toPage: number;                     // page reached after the session
  pagesRead: number;                  // toPage - fromPage, stored for fast stats
}

interface List     { id: string; name: string; description?: string; createdAt: string; sortOrder: number }
interface ListItem { listId: string; entryId: string; position: number; addedAt: string }
interface Category { id: string; name: string; kind: "genre" | "shelf"; isFiction?: boolean; colour?: string }

interface Note {
  id: string;
  entryId: string;
  readId?: string;
  page?: number;
  kind: "note" | "quote";
  text: string;                       // plain text with markdown allowed
  createdAt: string; updatedAt: string;
}

interface Goal { year: number; targetBooks?: number; targetPages?: number }

type EditableField = "title" | "subtitle" | "isbn13" | "isbn10" | "publisher" | "publishYear"
  | "pageCount" | "language" | "format" | "coverUrl";
```

**Effective values:** the app always reads `overrides[field] ?? sourceValue`. A refresh from the source updates source values and `fetchedAt` but never touches `overrides`.

**Deduplication:** works, editions and authors are unique by `sourceRef`. Adding an edition whose work or authors already exist reuses those records.

**Deletion:** removing a library entry deletes its reads, sessions, notes and list items. Works, editions and authors without any library entry may be garbage-collected.

**Local copy and overrides:** when the user adds a book, the app saves its own copy of the catalog data. The user can then edit any field, such as a wrong year, a missing page count or a better cover. Edits are stored as local overrides on top of the source data, so refreshing from the source never wipes them out.

**Gaps:** if an edition has no page count or cover, the app falls back to the work's typical page count or another edition's cover, and marks the value as borrowed so the user can correct it.

**Manual entry:** creates the same records with source "manual". Title and author are required. ISBN, page count, language, publisher, year and a cover photo are optional.

**Categories:** the app keeps its own categories. Open Library subjects are only offered as suggestions, since they are noisy and often missing for Danish books.

## Library and lists

**Core flow:** search the catalog, pick a book (edition), and add it to my personal library.

**Statuses:** every book in the library has one reading status: **to read**, **currently reading**, **finished** or **DNF** (did not finish). DNF books go into their own DNF pile, and the app remembers the page I stopped at.

**Lists:** I can create my own named lists (for example "Summer 2027" or "Danish classics") and put books in them. A book can be in several lists. Lists are separate from status and from categories.

### Adding a book

1. User searches; results are works (cover, title, authors, first year, edition count).
2. User picks a work, then picks their edition from the work's editions. Editions in the user's preferred languages (default `dan`, `eng`) are listed first, then by publish year descending. A "Can't find my edition" option creates a manual edition under that work.
3. User chooses the initial status (default `to_read`) and optionally lists and categories.
4. App stores Work, Authors, Edition and LibraryEntry. If the edition lacks `pageCount`, copy the work's `medianPageCount` and set `borrowed.pageCount = true`; same for the cover, taking the first edition of the work with a cover.
5. Adding an edition already in the library opens the existing entry instead.

### Status transitions

| From | To | Side effects |
| --- | --- | --- |
| (new) | to\_read | none |
| (new) | reading | create Read with `startedOn = today` |
| (new) | finished | create Read with `startedOn` and `endedOn` asked from user (default today), `outcome = finished` |
| to\_read | reading | create Read, `startedOn = today` |
| reading | finished | close current Read: `endedOn = today`, `outcome = finished`; if last session's `toPage < pageCount`, add a session up to `pageCount` |
| reading | dnf | close current Read: `outcome = dnf`, `stoppedAtPage` = last session's `toPage` (user can edit) |
| reading | to\_read | delete the open Read only if it has no sessions; otherwise ask the user to mark it DNF |
| finished or dnf | reading | create a new Read (reread or retry); previous reads stay |
| finished or dnf | to\_read | allowed; no read changes |

At most one open Read per entry. The **DNF pile** is the view of entries with `status = dnf`. All dates in these transitions can be edited afterwards.

## Reading tracking

**Progress:** tracked in pages against the edition I own. Because many stats depend on when and how much I read, progress is logged as **reading sessions**: a date (and time), a start page and an end page, and optionally the minutes spent. Updating "current page" simply creates a session behind the scenes.

**Reads:** a book can be read more than once. Each read has its own start date, end date, sessions and outcome (finished or DNF), so rereads count separately.

**Notes:** attach to the edition, optionally tied to a page. Format still open.

**Ratings:** needed for the ratings stats. Scale still open.

### Logging progress

- The "currently reading" screen has a quick "I'm on page N" input (also accepting a percentage, converted with the effective page count). Submitting creates a ReadingSession with `fromPage` = previous `toPage` (or 0), `toPage = N`, `startedAt = now`.
- A full session form allows date, start time, duration, and from/to pages, for logging past reading.
- An optional reading timer: start and stop, then ask for the page reached; it fills `durationMinutes`.
- Validation: `0 ≤ fromPage < toPage ≤ pageCount` (when known); `toPage` lower than the previous session is rejected with a hint to edit that session instead. Sessions can be edited and deleted.
- If `toPage` reaches the page count, prompt "Mark as finished?".

## Statistics

Statistics are the heart of the app. All of the following are in scope.

**Totals and goals**

- Books and pages read this year, all time and per month
- A yearly reading goal with a pace line ("3 books ahead of schedule")
- Year in review: a shareable summary each December

**Reading habits** (from reading sessions)

- Reading streaks, and a calendar heatmap of reading days
- Pages per day, and favourite day of the week or time of day to read
- Reading speed in pages per hour, and a finish-date forecast for the current book
- Time to finish each book, and fastest and slowest reads

**What I read**

- Genres and categories over time
- Top authors, and authors new to me vs. returning
- Languages read, originals vs. translations, Danish vs. English
- Publication decades, from classics to new releases
- Book length distribution
- Fiction vs. non-fiction balance

**My library**

- To-read pile size and how long books wait before I start them
- Started vs. finished, the DNF pile, and where I tend to stop reading
- Rereads and most-read authors

**Fun extras**

- Total pages as a stack height compared with landmarks
- A map of where my authors come from
- Ratings vs. book length, and ratings by genre
- Achievements: tiered medals, one-off specials and reader levels (see Achievements)

**Data each stat needs:** most come from catalog data (pages, authors, subjects, year, language) plus my statuses, reads and sessions. Fiction vs. non-fiction and genres rely on my own categories, with Open Library subjects as suggestions. Author country is not in Open Library and needs another source (see open questions).

### Counting rules

These rules apply to every stat so the numbers agree with each other.

- **Book read:** a Read with `outcome = finished`. It counts in the period containing `endedOn`. Rereads count again; "unique books" counts distinct works.
- **Pages read:** the sum of `pagesRead` over sessions, assigned to the local date of `startedAt`. This includes pages from DNF reads. A finished read with no sessions counts its effective page count on `endedOn`.
- **Reading day:** a local calendar date with at least one session.
- **Attribute stats** (genre, author, language, decade, length) are computed over finished reads in the selected period, by default. A toggle includes DNF reads.
- **Time zone:** the user's device time zone, captured per session so travel doesn't move past days.
- Every stat screen has a period filter: this year (default), last year, any year, last 12 months, all time, custom range.

### Stat definitions

| Stat | Definition | Display |
| --- | --- | --- |
| Books read | count of finished reads in period | number, plus bar chart per month |
| Pages read | sum of pages in period | number, plus bar chart per month |
| Goal pace | expected = target × (days elapsed ÷ days in year); ahead/behind = actual − expected | progress bar with a pace marker and "N books ahead/behind" |
| Year in review | per year: books, pages, top 5 authors and genres, longest and shortest book, fastest read, highest rated, streak record, first and last book | a full-screen card sequence, exportable as an image |
| Current streak | consecutive reading days ending today or yesterday | number with flame icon |
| Longest streak | longest run of consecutive reading days ever | number with date range |
| Heatmap | pages per reading day for the last 365 days | calendar grid, 5 intensity steps |
| Pages per day | pages in period ÷ days in period; also average over reading days only | two numbers |
| Favourite day / time | pages grouped by weekday and by hour of `startedAt` | bar charts |
| Reading speed | sum of `pagesRead` ÷ sum of `durationMinutes` × 60, over sessions with a duration | pages per hour, overall and per book |
| Finish forecast | remaining pages ÷ average pages per day over the current read's last 14 days | "Finish around 12 Dec" |
| Time to finish | `endedOn − startedOn + 1` days per finished read | list sorted; fastest and slowest highlighted |
| Genres over time | share of finished reads per genre category, per month or year | stacked bar chart |
| Top authors | finished reads grouped by author | ranked list |
| New vs. returning authors | an author is new in the period if none of their works had a finished read before the period started | two numbers and share |
| Languages | finished reads grouped by edition language | donut chart |
| Originals vs. translations | translated if edition `language` differs from work `originalLanguage`; unknown if either is missing | three-way split |
| Publication decades | finished reads grouped by `floor(firstPublishYear ÷ 10) × 10` | bar chart |
| Length distribution | finished reads bucketed by page count: under 200, 200–349, 350–499, 500–749, 750+ | histogram |
| Fiction vs. non-fiction | from the `isFiction` flag on genre categories; unknown if no flagged category | split bar |
| To-read pile | count of `to_read` entries; average and longest wait = today − `addedAt` | numbers plus oldest five |
| Wait before starting | for reads begun from to\_read: `startedOn − addedAt` | average and distribution |
| Started vs. finished | reads started in period vs. reads finished in period vs. DNF | three numbers |
| Where I stop | for DNF reads: `stoppedAtPage ÷ pageCount`, bucketed by 10% | histogram |
| Rereads | works with more than one finished read | list with counts |
| Stack height | total pages × 0.1 mm (configurable), compared with a list of landmarks such as the Round Tower (about 35 m) | "You've read N Round Towers" |
| Author map | finished reads grouped by author `country` | world map; authors without country listed as unknown |
| Ratings vs. length | rating against page count per finished read | scatter plot |
| Ratings by genre | average rating per genre category | bar chart |
| Achievements | tiered families and specials, see Achievements | level card, Achievements screen; unlock dates worked out from the data |

Stats are computed on demand from the stored records. If that gets slow, cache per-day aggregates (pages, minutes, sessions per date).

## Screens

Mobile-first: a bottom tab bar with five tabs. On wide screens it becomes a side bar.

| Tab | Contents |
| --- | --- |
| Home | Currently reading cards with progress bar, quick "I'm on page N" input and finish forecast; current streak; goal pace |
| Search | Search box (text or ISBN), results list, work detail with edition picker, "Add manually" at the bottom of results and on empty results |
| Library | Filter by status (to read, reading, finished, DNF pile), list, category, language; sort by added, title, author, finished date, rating; grid or list view |
| Stats | Period filter; sections matching the stat groups; year in review entry point |
| Profile | Theme, goals, lists and categories management, preferred languages, export and import, settings, danger zone |

**Book detail** (from anywhere): cover, effective metadata with an edit button, status control, reads history with sessions, notes and quotes, lists and categories, rating, link to Open Library.

## Achievements

Achievements gamify reading. They are worked out purely from the stats model and the yearly goals (`src/domain/achievements.ts`), so imports, edits and deletes keep them right. Unlock dates are derived from the data: the date of the session, finish or rating that crossed the threshold.

- **Families**: 14 tiered achievements with bronze, silver, gold and platinum thresholds, in four groups.
  - Reading: Bookworm (books finished 5/15/30/60), Page turner (pages 1k/5k/15k/40k), Marathoner (finished books of 500+ pages 1/3/6/12), Speed reader (books finished within 7 days of starting 1/3/8/20).
  - Habits: On a roll (longest streak 7/30/60/100 days), Devoted (reading days 30/100/250/500), Goal getter (yearly goals met 1/2/3/5).
  - Variety: Explorer (genres of finished books 3/5/8/12), Globetrotter (author countries 3/6/10/20), Polyglot (languages 2/3/4/5), Time traveller (publication decades 3/5/8/10), Superfan (most books by one author 3/5/8/12).
  - Collection: Old friends (rereads 1/3/6/10), Collector (books in the library 25/50/100/250).
- **Specials**: 13 one-off achievements: First chapter, Big day (100 pages in a day), Weekend binge (250 pages over a Saturday and Sunday), Night owl (a session starting 23:00 to 04:00), Early bird (a session starting 05:00 to 07:00), Doorstopper (800+ pages finished), Short and sweet (under 150 pages), Classic (published before 1900), Hot off the press (finished in its publication year), Lost in translation (a finished book read in translation), All year round (reading in all 12 months of one year), Life is short (first DNF), Critic (10 ratings).
- **Points and levels**: bronze 10, silver 25, gold 50, platinum 100, special 25. Levels: Puppy 0, Fetcher 100, Sniffer 300, Tracker 700, Bloodhound 1,300, Readhound 2,100.
- **Where it shows**: a level card on Home, Stats and Profile links to the Achievements screen (`/achievements`), which lists families by group with tier pips, next goal and progress, then the specials grid. Filters: All, Unlocked, Still to earn.
- **Unlock moments**: the only stored state is the setting `achievementsSeen` ({ ids, level }). A newly earned achievement or level shows a toast with a confetti burst, once. The first run on a database (and in demo mode) is silent apart from a single welcome toast summarising what is already earned. Toasts honour reduced motion.

## Danger zone

The last section of Profile deletes everything Readhound stores on this device. That covers every table in the personal database: books, editions and authors, reads, sessions, notes, lists, categories, goals, settings (including the last-backup time) and the Open Library cache.

It is deliberately hard to trigger:
1. Tap **Delete all my data…**.
2. Optionally save a backup with **Export backup**, which is offered right there.
3. Type `DELETE` (any case) to enable **Delete everything**.

**What it leaves alone:**
- **Theme:** a per-device preference kept outside the database.
- **Demo database:** in demo mode the section only says to leave demo mode first, so the sample data can never be confused with the real library. **Reset sample data** on the demo page already covers the demo database.

## Themes and animation

The user picks one of four themes in **Profile → Theme**. The choice is a per-device preference stored in `localStorage` (`readhound.theme`). An inline script in `index.html` applies it before the first paint, so there is no flash. It is not part of the backup.

| Theme | Look | Light and dark |
| --- | --- | --- |
| Classic (default) | Calm stone and amber, the original look | Follows the system |
| Aurora | Violet, pink and sky-blue gradient background; frosted-glass cards; gradient titles and numbers; a floating pill tab bar on phones; Plus Jakarta Sans | Follows the system |
| Bookshop | Warm paper; Fraunces serif titles with DM Sans text; ink outlines with an offset shadow; stat tiles and Home cards cycle through peach, sage, butter and lavender | Follows the system |
| Midnight | Deep navy with an indigo glow; gradient-edged cards; glowing lime active tab; lime-to-cyan numbers; Space Grotesk | Always dark |

**How themes work:**
- A theme is a `data-theme` attribute on `<html>` that overrides the shadcn tokens, plus extra tokens: `--font-sans`, `--font-display`, `--page-paint`, `--surface-*`, `--title-paint`, `--number-paint`, `--primary-paint`, `--fill`, `--indicator` and `--tint-1..4`.
- Components use a few semantic utilities: `surface`, `title`, `stat-value`, `fill-bar`, `btn-primary`, `banner` and `tint-cycle`. A new screen gets every theme for free by using them.
- Fonts are self-hosted with Fontsource. Only the Latin and Latin Extended subsets are precached for offline use.
- **Charts:** every theme uses the validated categorical palette in its fixed order, rotated so that slot 1 is the theme's hue:
  - Classic: blue
  - Aurora: violet
  - Bookshop: orange
  - Midnight: green, using the dark steps
- Each rotation was re-run through the palette validator for its light and dark surfaces and passes. The contrast warnings for the light steps are the same as for the reference order and are covered by the table views.
- The heatmap and author map ramp is one hue: slot 1 mixed into the empty-cell colour at 30, 55, 80 and 100 %.

**Animation** (Motion and CSS keyframes; everything respects `prefers-reduced-motion`):
- Screens ease in when you change screen.
- Cards rise in a short stagger.
- The active tab highlight slides between tabs with a spring.
- Buttons press in. Bookshop buttons move into their shadow.
- Progress and goal bars grow from zero. The goal pace marker pops in.
- Stat numbers count up, and glide to new values when the data changes.
- The streak flame flickers.
- Covers fade in once loaded.
- Changing theme cross-fades with the View Transitions API where it is supported.
- Finishing a book bursts confetti.
- Charts animate when their card scrolls into view rather than off screen:
  - bars grow from the baseline, and stacked series follow one after another
  - donuts sweep clockwise from the top
  - heatmap cells pop in week by week
  - author countries pop in by intensity
  - tooltips glide

## Tech stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript (strict mode) |
| UI framework | React 19 |
| Build tool | Vite |
| App shell | Progressive Web App (installable, offline via a service worker, e.g. vite-plugin-pwa) |
| Mobile apps (later) | Capacitor wrapping the same build for iOS and Android; camera plugin for ISBN barcode scanning |
| Routing | React Router |
| Styling | Tailwind CSS |
| Components | shadcn/ui (Radix primitives) |
| Animation | Motion (formerly Framer Motion) |
| Charts | Visx / D3 for custom charts (heatmap, author map, year in review); Recharts for standard bar, donut and line charts |
| Local database | Dexie on IndexedDB, with `useLiveQuery` for reactive screens |
| Server state and caching of Open Library calls | TanStack Query |
| Testing | Vitest and React Testing Library for units; Playwright for end-to-end |
| Hosting | Static files only, e.g. GitHub Pages or Cloudflare Pages; no backend |

The TypeScript types in this document are meant to be used directly. Code is organised by layer: `sources/` (adapters and registry), `db/` (Dexie schema and repositories), `domain/` (status transitions, session logic, stat calculations as pure functions), `ui/` (screens and components).

## Storage

- **Local only:** all user data lives on the device. There is no backend and no account in version 1. The only network calls go to Open Library.
- In the browser, data is stored in IndexedDB. The app requests persistent storage (`navigator.storage.persist()`) so the browser doesn't evict it.
- Browser data can still be lost (cleared site data, a new phone), so **export and import are essential**. The app reminds the user to export a backup if the last one is more than 30 days old.
- All storage access goes through a repository layer, so sync or a server can be added later without touching screens or stats.

## Non-functional requirements

- **Responsive:** usable from 360 px wide; touch targets at least 44 px.
- **Speed:** library and stats screens render in under 500 ms with 2,000 books and 50,000 sessions.
- **Offline:** the library, logging progress and stats work offline; search needs a connection and says so.
- **Text:** full Unicode, including Danish æ, ø, å; search on the local library ignores case and diacritics.
- **Language:** UI in English first; strings kept in a translation file so Danish can be added.
- **Data ownership:** export everything as JSON (complete) and CSV (library and reads); import the app's own JSON losslessly.
- **Accessibility:** WCAG 2.1 AA contrast, labelled controls, charts with a text or table alternative.
- **Testing:** unit tests for every stat definition and status transition; adapter tests against recorded Open Library responses, not the live API.

## Version 1 acceptance criteria

1. Searching "Project Hail Mary" or its ISBN 9780593135204 returns the book; adding it creates a library entry with title, author, page count and cover.
2. Searching "froken smilla" finds "Frøken Smillas fornemmelse for sne".
3. A search with no results offers manual entry prefilled with the query; a manual book with only title and author can be saved and tracked.
4. Editing a found book's page count persists after a refresh from Open Library.
5. Every transition in the status table behaves as specified, including DNF with a stop page and starting a reread.
6. Logging "page 120" then "page 180" creates two sessions of 120 and 60 pages.
7. Every stat in the definitions table is shown and matches a hand-calculated value on a fixed test data set.
8. The app works on a phone browser, and offline for everything except search.

## Open questions

- Where to host the static site (any free static host works)
- Sync between devices later (decided for now: data lives only on the device; see Storage)
- Accounts and sign-in, if data is synced
- Importing an existing library, for example from Goodreads or a spreadsheet
- Barcode scanning of ISBNs with the phone camera
- Source for author country (for example Wikidata, which Open Library authors often link to), or manual entry per author
- Original language of translated books: Open Library doesn't always record it, so it may need user input
- Note format and rating scale
- Which stats to build first, since all are in scope

## Decision log

| Date | Decision |
| --- | --- |
| 2026-11-25 | Start as a mobile-first web app; cross-platform later |
| 2026-11-25 | Books come from an external catalog; manual entry only as a last resort |
| 2026-11-25 | Open Library is the only source for version 1, behind a pluggable source interface |
| 2026-11-25 | Track the specific edition the user owns, linked to its work |
| 2026-11-25 | Users can edit details of found books; the app keeps its own categories |
| 2026-11-25 | Search and add books to a personal library; custom lists |
| 2026-11-25 | Statuses: to read, currently reading, finished, DNF (with its own DNF pile) |
| 2026-11-25 | Data lives only on the device for now; no hosting or backend |
| 2026-11-25 | Tech stack: React + TypeScript PWA, wrapped with Capacitor for mobile later |
| 2026-11-25 | Notes are plain text (markdown allowed, shown as written); the rating scale is 0.5–5 in half steps |
| 2026-11-25 | Backup reminder: counts from the last JSON export, or from the first book added before any export; "Later" hides it for 7 days |
| 2026-11-25 | JSON import replaces everything on the device after a confirmation; CSV exports are for spreadsheets only |
| 2026-11-25 | Demo mode: a separate `readhound-demo` database with about two years of generated sample reading; the real library is never touched |
| 2026-11-25 | Charts: Recharts for standard charts; the heatmap and author map are plain SVG with d3-geo, so Visx isn't needed. Chart colours use the validated reference categorical palette, with every chart also readable as a table |
| 2026-11-25 | Heatmap intensity: steps 1–4 are quarters of the biggest reading day in the last 12 months |
| 2026-11-25 | Achievement (formerly milestone) unlock dates are worked out from the data instead of stored, so imports and edits keep them right |
| 2026-11-25 | Wait before starting counts first reads that began after the day the book was added; books added as reading or finished are left out |
| 2026-11-25 | Year in review: a full-screen card sequence per year (from Stats, and on Home in December), saved as a 1080 × 1350 PNG drawn on a canvas, shared through the phone's share sheet where available |
| 2026-11-25 | Four themes (Classic, Aurora, Bookshop, Midnight), chosen per device in Profile; motion across screens and charts, all honouring reduced motion |
| 2026-11-25 | Danger zone at the bottom of Profile: deletes the whole personal database (settings and cache included) after an export offer and typing DELETE; keeps the theme; hidden in demo mode and never touches the demo database |
| 2026-11-25 | Achievement system replaces milestones: 14 tiered families (bronze to platinum), 13 specials, points and six dog-themed reader levels; derived from the data, only the seen state is stored so each unlock toasts once |
