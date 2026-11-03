import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { languageDetector, type LanguageVariables } from 'hono/language'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { DEFAULT_LANGUAGE, LANGUAGES, translate } from './i18n.js'
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
  /**
   * Origine(s) autorisée(s) à appeler l'API depuis un navigateur (le front Nuxt),
   * séparées par des virgules : "http://localhost:3000,https://mon-front.app".
   */
  corsOrigin?: string
}

/** "a, b,,c" -> ["a", "b", "c"] */
export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

/** "25" -> 25 ; tout ce qui n'est pas un entier positif -> null. */
function parseId(raw: string): number | null {
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : null
}

type Env = { Variables: LanguageVariables }

/**
 * Réponse d'erreur : `code` stable (lu par le front), `error` traduit
 * selon Accept-Language (anglais par défaut).
 */
function fail(
  c: Context<Env>,
  status: ContentfulStatusCode,
  code: ErrorCode,
  params?: Record<string, string | number>,
) {
  const body: ErrorResponse = {
    error: translate(c.get('language'), `errors.${code}`, params),
    code,
  }
  return c.json(body, status)
}

export function createApp({
  version,
  commit,
  store = new MemoryWishlistStore(),
  corsOrigin = DEFAULT_CORS_ORIGIN,
}: AppOptions) {
  const app = new Hono<Env>()

  app.use(
    '*',
    cors({
      origin: parseOrigins(corsOrigin),
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Accept-Language'],
    }),
  )

  // Langue des messages : en-tête Accept-Language ("fr-FR" -> fr), sinon anglais.
  app.use(
    '*',
    languageDetector({
      supportedLanguages: [...LANGUAGES],
      fallbackLanguage: DEFAULT_LANGUAGE,
      order: ['header'],
      caches: false,
    }),
  )
  app.use('*', async (c, next) => {
    await next()
    c.header('Content-Language', c.get('language') ?? DEFAULT_LANGUAGE)
  })

  app.get('/health', (c) =>
    c.json<HealthResponse>({ status: 'ok', version, commit }),
  )

  app.get('/wishlist', async (c) => c.json(await store.list(), 200))

  app.post('/wishlist', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return fail(c, 400, 'invalid_body')
    }

    const pokemon = parsePokemonInput(body)
    if (!pokemon) {
      return fail(c, 400, 'invalid_body')
    }

    const result = await store.add(pokemon)
    switch (result.status) {
      case 'duplicate':
        return fail(c, 409, 'duplicate')
      case 'full':
        return fail(c, 409, 'full', { max: MAX_WISHLIST_SIZE })
      case 'added':
        c.header('Location', `/wishlist/${pokemon.id}`)
        return c.json(result.item, 201)
    }
  })

  app.delete('/wishlist/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    if (id === null) {
      return fail(c, 400, 'invalid_id')
    }

    const removed = await store.remove(id)
    if (!removed) {
      return fail(c, 404, 'not_found')
    }
    return c.json(removed, 200)
  })

  app.notFound((c) => fail(c, 404, 'route_not_found'))

  // Base injoignable, erreur SQL inattendue… : 500 en JSON, détail dans les logs.
  app.onError((err, c) => {
    console.error(err)
    return fail(c, 500, 'internal_error')
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
