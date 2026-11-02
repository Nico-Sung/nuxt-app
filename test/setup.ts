import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Garde-fou « zéro réseau » : tout appel à fetch non simulé fait échouer le test.
 * Un test qui a besoin de fetch le remplace avec vi.stubGlobal('fetch', ...).
 */
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Appel réseau non simulé dans un test')
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})
