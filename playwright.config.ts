import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * End-to-end tests run the production build (`npm run build` first) in a
 * phone-sized Chromium. Open Library is stubbed with the recorded fixtures,
 * so the tests never touch the network.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}`,
    // The service worker would cache the app shell between tests and could
    // answer requests before the Open Library stubs see them.
    serviceWorkers: 'block',
    locale: 'en-GB',
    timezoneId: 'Europe/Copenhagen',
    trace: 'off',
  },
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
