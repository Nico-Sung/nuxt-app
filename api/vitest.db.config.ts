import { defineConfig } from 'vitest/config'

// Tests d'intégration sur une vraie base Postgres de test (npm run test:db).
export default defineConfig({
  test: {
    include: ['test/db/**/*.test.ts'],
    globalSetup: ['test/db/globalSetup.ts'],
    // Une seule table partagée : les fichiers passent l'un après l'autre.
    fileParallelism: false,
    testTimeout: 10_000,
  },
})
