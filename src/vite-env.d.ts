/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Contact email for the Open Library User-Agent, where one can be sent. */
  readonly VITE_OPENLIBRARY_CONTACT_EMAIL?: string
}

/** The app version from package.json, injected by Vite. */
declare const __APP_VERSION__: string
