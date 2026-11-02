import { Hono } from 'hono'
import { shortSha, VERSION } from './version.js'
import {
  MAX_WISHLIST_SIZE,
  parsePokemonInput,
  WishlistStore,
} from './wishlist.js'

export interface HealthResponse {
  status: 'ok'
  version: string
  commit: string
}

export interface ErrorResponse {
  error: string
}

export interface AppOptions {
  version: string
  commit: string
  /** Stockage de la liste ; un store neuf par défaut (utile pour isoler les tests). */
  store?: WishlistStore
}

/** "25" -> 25 ; tout ce qui n'est pas un entier positif -> null. */
function parseId(raw: string): number | null {
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : null
}

export function createApp({
  version,
  commit,
  store = new WishlistStore(),
}: AppOptions) {
  const app = new Hono()

  app.get('/health', (c) =>
    c.json<HealthResponse>({ status: 'ok', version, commit }),
  )

  app.get('/wishlist', (c) => c.json(store.list(), 200))

  app.post('/wishlist', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json<ErrorResponse>({ error: 'Corps invalide' }, 400)
    }

    const pokemon = parsePokemonInput(body)
    if (!pokemon) {
      return c.json<ErrorResponse>({ error: 'Corps invalide' }, 400)
    }

    const result = store.add(pokemon)
    switch (result.status) {
      case 'duplicate':
        return c.json<ErrorResponse>(
          { error: 'Pokémon déjà dans la liste' },
          409,
        )
      case 'full':
        return c.json<ErrorResponse>(
          { error: `Liste pleine (${MAX_WISHLIST_SIZE} max)` },
          409,
        )
      case 'added':
        c.header('Location', `/wishlist/${pokemon.id}`)
        return c.json(result.item, 201)
    }
  })

  app.delete('/wishlist/:id', (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) {
      return c.json<ErrorResponse>({ error: 'Id invalide' }, 400)
    }

    const removed = store.remove(id)
    if (!removed) {
      return c.json<ErrorResponse>({ error: 'Pokémon absent de la liste' }, 404)
    }
    return c.json(removed, 200)
  })

  app.notFound((c) => c.json<ErrorResponse>({ error: 'Not Found' }, 404))

  return app
}

/** App configurée à partir de package.json et de la variable GIT_SHA. */
export const app = createApp({
  version: VERSION,
  commit: shortSha(process.env.GIT_SHA),
})
