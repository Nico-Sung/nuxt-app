import { defineConfig } from 'vitest/config'

// npm run test:coverage : tests unitaires ET tests sur Postgres, en un seul
// calcul (sinon le stockage Postgres paraîtrait non testé). Base de test requise.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/db/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // points d'entrée (serveur Node, CLI des migrations) : pas de logique
      exclude: ['src/index.ts', 'src/migrate.ts'],
      reporter: ['text-summary', 'json-summary', 'json', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
