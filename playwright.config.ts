import { defineConfig, devices } from '@playwright/test'
import {
  API_PORT,
  API_URL,
  NUXT_PORT,
  NUXT_URL,
  POKEAPI_PORT,
  POKEAPI_URL,
} from './e2e/env'

export default defineConfig({
  testDir: 'e2e',
  // L'API garde une seule liste en mémoire : les tests s'exécutent un par un.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: NUXT_URL,
    // Les parcours existants sont écrits en français (e2e/i18n.spec.ts teste l'anglais).
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Les deux serveurs réels + un faux PokéAPI. Nuxt doit être compilé avant (`npm run build`).
  webServer: [
    {
      name: 'Faux PokéAPI',
      command: 'node e2e/fake-pokeapi.mjs',
      url: `${POKEAPI_URL}/health`,
      env: { PORT: String(POKEAPI_PORT) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      name: 'API Hono',
      command: 'npm --prefix api run build && npm --prefix api start',
      url: `${API_URL}/health`,
      env: {
        PORT: String(API_PORT),
        CORS_ORIGIN: NUXT_URL,
        // Toujours en mémoire : les tests vident la liste à chaque fois,
        // ils ne doivent jamais toucher une vraie base (Supabase).
        DATABASE_URL: '',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'Nuxt',
      command: 'node .output/server/index.mjs',
      url: NUXT_URL,
      env: {
        PORT: String(NUXT_PORT),
        NUXT_PUBLIC_API_BASE: API_URL,
        NUXT_POKEAPI_BASE: `${POKEAPI_URL}/api/v2`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
