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

To serve from a sub-path (for example GitHub Pages), build with `BASE_PATH=/readhound/ npm run build`.

## Tech stack

React 19, TypeScript (strict), Vite, Tailwind CSS 4 with shadcn/ui, React Router, and vite-plugin-pwa. Still to come as features land: Dexie for the local database, TanStack Query for Open Library calls, Motion for animation, Visx/D3 and Recharts for charts, Playwright for end-to-end tests, and Capacitor for the iOS and Android apps.

## Code layout

```
src/
  app/        router and app root
  i18n/       UI strings (English now, Danish later)
  lib/        small shared helpers
  ui/         screens, layout and components (shadcn/ui lives in ui/components/ui)
```

Following the design doc, later pull requests add `sources/` (book source adapters and registry), `db/` (Dexie schema and repositories) and `domain/` (status transitions, session logic and stat calculations as pure functions).

To add a shadcn/ui component: `npx shadcn@latest add <component>` (configured by `components.json`).
