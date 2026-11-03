import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { shortSha, VERSION } from './version.js'
import { connect, PostgresWishlistStore } from './postgresStore.js'
import {
  MAX_WISHLIST_SIZE,
  MemoryWishlistStore,
  parsePokemonInput,
  type WishlistStore,
} from './wishlist.js'

export interface HealthResponse {
  status: 'ok'
  version: string
  commit: string
}

/** Codes d'erreur lisibles par le front. */
export type ErrorCode =
  | 'invalid_body'
  | 'duplicate'
  | 'full'
  | 'invalid_id'
  | 'not_found'
  | 'route_not_found'
  | 'internal_error'

export interface ErrorResponse {
  error: string
  code: ErrorCode
}

export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000'

export interface AppOptions {
  version: string
  commit: string
  /** Stockage de la liste ; une liste en mémoire neuve par défaut (isole les tests). */
  store?: WishlistStore
  /** Origine autorisée à appeler l'API depuis un navigateur (le front Nuxt). */
  corsOrigin?: string
}

/** "25" -> 25 ; tout ce qui n'est pas un entier positif -> null. */
function parseId(raw: string): number | null {
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : null
}

const error = (code: ErrorCode, message: string): ErrorResponse => ({
  error: message,
  code,
})

export function createApp({
  version,
  commit,
  store = new MemoryWishlistStore(),
  corsOrigin = DEFAULT_CORS_ORIGIN,
}: AppOptions) {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: corsOrigin,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  )

  app.get('/health', (c) =>
    c.json<HealthResponse>({ status: 'ok', version, commit }),
  )

  app.get('/wishlist', async (c) => c.json(await store.list(), 200))

  app.post('/wishlist', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(error('invalid_body', 'Corps invalide'), 400)
    }

    const pokemon = parsePokemonInput(body)
    if (!pokemon) {
      return c.json(error('invalid_body', 'Corps invalide'), 400)
    }

    const result = await store.add(pokemon)
    switch (result.status) {
      case 'duplicate':
        return c.json(error('duplicate', 'Pokémon déjà dans la liste'), 409)
      case 'full':
        return c.json(
          error('full', `Liste pleine (${MAX_WISHLIST_SIZE} max)`),
          409,
        )
      case 'added':
        c.header('Location', `/wishlist/${pokemon.id}`)
        return c.json(result.item, 201)
    }
  })

  app.delete('/wishlist/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) {
      return c.json(error('invalid_id', 'Id invalide'), 400)
    }

    const removed = await store.remove(id)
    if (!removed) {
      return c.json(error('not_found', 'Pokémon absent de la liste'), 404)
    }
    return c.json(removed, 200)
  })

  app.notFound((c) => c.json(error('route_not_found', 'Not Found'), 404))

  // Base injoignable, erreur SQL inattendue… : 500 en JSON, détail dans les logs.
  app.onError((err, c) => {
    console.error(err)
    return c.json(error('internal_error', 'Erreur interne'), 500)
  })

  return app
}

/** Postgres si DATABASE_URL est défini (ex. Supabase), sinon en mémoire. */
export function storeFromEnv(
  databaseUrl = process.env.DATABASE_URL,
): WishlistStore {
  return databaseUrl
    ? new PostgresWishlistStore(connect(databaseUrl))
    : new MemoryWishlistStore()
}

/** App configurée à partir de package.json et des variables GIT_SHA, CORS_ORIGIN, DATABASE_URL. */
export const app = createApp({
  version: VERSION,
  commit: shortSha(process.env.GIT_SHA),
  corsOrigin: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
  store: storeFromEnv(),
})
