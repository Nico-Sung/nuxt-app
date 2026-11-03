import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    // npm run test:coverage. Périmètre : la logique TypeScript testée par
    // Vitest. Les composants .vue, composables et routes serveur (colle Nuxt /
    // Nitro, auto-imports) sont testés par Playwright, pas comptés ici.
    coverage: {
      provider: 'v8',
      include: [
        'app/utils/**',
        'shared/utils/**',
        'server/lib/**',
        'build/**',
        'scripts/**',
      ],
      // script réseau lancé à la main (régénère shared/data)
      exclude: ['scripts/generate-pokemon-names.mjs'],
      reporter: ['text-summary', 'json-summary', 'json', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
