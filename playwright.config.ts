import { defineConfig, devices } from '@playwright/test'
import { API_PORT, API_URL, NUXT_PORT, NUXT_URL } from './e2e/env'

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
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Les deux serveurs réels. Nuxt doit être compilé avant (`npm run build`).
  webServer: [
    {
      name: 'API Hono',
      command: 'npm --prefix api run build && npm --prefix api start',
      url: `${API_URL}/health`,
      env: { PORT: String(API_PORT), CORS_ORIGIN: NUXT_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'Nuxt',
      command: 'node .output/server/index.mjs',
      url: NUXT_URL,
      env: { PORT: String(NUXT_PORT), NUXT_PUBLIC_API_BASE: API_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
