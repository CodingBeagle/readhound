import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // The base path can be set at build time for hosts that serve from a sub-path,
  // e.g. GitHub Pages: `BASE_PATH=/readhound/ npm run build`.
  base: process.env.BASE_PATH ?? '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Readhound',
        short_name: 'Readhound',
        description: 'Track what you read, organise your books and explore your reading stats.',
        theme_color: '#1c1917',
        background_color: '#fafaf9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell is precached so the library, logging and stats work offline.
        // Theme fonts: only the Latin subsets (English and Danish) are precached; others load on demand.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}', '**/*-latin-wght-normal-*.woff2', '**/*-latin-ext-wght-normal-*.woff2'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
