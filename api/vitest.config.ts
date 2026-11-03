import { defineConfig } from 'vitest/config'

// Tests unitaires : rapides, sans base de données (stockage en mémoire).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/db/**'],
  },
})
