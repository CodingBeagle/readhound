# Readhound

A personal book reading tracker: what I'm reading now, my library sorted into my own categories and lists, and lots of statistics about my reading.

Readhound is a mobile-first Progressive Web App. All data stays on the device (IndexedDB), with export and import for backups. Book metadata comes from [Open Library](https://openlibrary.org), with manual entry as the fallback.

## Design

The full specification lives in [`docs/design.md`](docs/design.md): data model, Open Library adapter, status transitions, reading sessions, stat formulas, screens and acceptance criteria. It is a snapshot of the living design document; update both when a decision changes.

## Getting started

Requires Node 22 (see `.nvmrc`).

```sh
npm install
npm run dev        # dev server at http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build the production PWA into `dist/` |
| `npm run preview` | Serve the production build locally (service worker included) |
| `npm run typecheck` | Run TypeScript in build mode |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run the unit tests once with Vitest |
| `npm run generate-pwa-assets` | Regenerate the app icons in `public/` from `public/logo.svg` |

To serve from a sub-path, build with `BASE_PATH=/readhound/ npm run build`.

## Deployment

Every push to `main` builds the app and publishes it to GitHub Pages at https://codingbeagle.github.io/readhound/ (`.github/workflows/deploy.yml`). The workflow builds with the `/readhound/` base path, so the router, PWA manifest scope and service worker all live under that path, and it copies `index.html` to `404.html` so deep links such as `/readhound/stats` load the app. It can also be run by hand from the Actions tab.

One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Book sources

`src/sources/` holds the pluggable book-source layer from the design doc: the `BookSource` interface, a `SourceRegistry` that asks sources in priority order (the UI only talks to the registry), ISBN helpers, a throttled and cached HTTP client, and the Open Library adapter. Its tests run against recorded Open Library responses in `src/sources/openlibrary/__fixtures__`, never the live API.

Open Library asks apps to send `User-Agent: Readhound/<version> (<contact email>)`. Browsers can't send that header to Open Library (its CORS rules reject it), so the web app doesn't, and throttles itself to Open Library's unidentified limit of 1 request per second instead of 3. The header is sent outside the browser, and the contact email comes from `VITE_OPENLIBRARY_CONTACT_EMAIL` if set.

## Backup and demo mode

Everything lives in the browser's IndexedDB, so Profile has export (complete JSON, plus library and reads as CSV) and import. Home reminds you to export when the last backup is more than 30 days old.

Demo mode (Profile → Demo mode, or `/demo`) switches the app to a separate `readhound-demo` database filled with about two years of generated reading from `src/demo/sampleLibrary.ts`, so the library and stats have something to show. A banner shows while it is on; leaving demo mode returns to the real library untouched.

## Tech stack

React 19, TypeScript (strict), Vite, Tailwind CSS 4 with shadcn/ui, React Router, and vite-plugin-pwa. Dexie stores everything locally and screens read it through `dexie-react-hooks` live queries; TanStack Query handles Open Library calls. Recharts draws the stats charts, with d3-geo for the author map. Still to come as features land: Motion for animation, Playwright for end-to-end tests, and Capacitor for the iOS and Android apps.

## Code layout

```
src/
  app/        router, app root and the services provider (database, repositories, book sources)
  db/         Dexie (IndexedDB) schema, repositories, and backup export/import: the only way screens touch stored data
  demo/       sample data generator for demo mode
  domain/     record types and pure logic: status transitions, session rules, effective values
  i18n/       UI strings (English now, Danish later)
  lib/        small shared helpers
  sources/    book source adapters and registry (Open Library)
  ui/         screens, layout, book components and hooks (shadcn/ui lives in ui/components/ui)
```

Stat calculations live in `domain/stats/` as pure functions over a joined model (`buildStatsModel`), tested against a hand-calculated data set and a 50,000-session timing check.

Screen tests (`src/ui/screens/screens.test.tsx`) render the real routes against a throwaway IndexedDB (fake-indexeddb) and the recorded Open Library fixtures.

To add a shadcn/ui component: `npx shadcn@latest add <component>` (configured by `components.json`).
