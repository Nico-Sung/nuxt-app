import postgres from 'postgres'

/**
 * Base Postgres de test utilisée par l'API pendant l'E2E (jamais Supabase) :
 * les parcours sont vérifiés jusqu'à la table, relue en SQL.
 */
export const E2E_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:54329/wishlist_test'

/** Garde-fou : une base locale dont le nom finit par _test, sinon on refuse. */
export function assertTestDatabase(raw: string): string {
  const url = new URL(raw)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!local || !url.pathname.slice(1).endsWith('_test')) {
    throw new Error(
      `E2E refusé sur ${url.hostname}${url.pathname} : il faut une base locale *_test.`,
    )
  }
  return raw
}

let sql: postgres.Sql | undefined

export function db(): postgres.Sql {
  sql ??= postgres(assertTestDatabase(E2E_DATABASE_URL), {
    max: 2,
    onnotice: () => {},
  })
  return sql
}

/** Liste et likes vides. */
export async function resetDatabase() {
  await db()`truncate table public.wishlist, public.pokemon_likes`
}

export const dbWishlist = () =>
  db()<{ pokemon_id: number; name: string }[]>`
    select pokemon_id, name from public.wishlist order by added_at, pokemon_id
  `

export const dbLikes = () =>
  db()<{ pokemon_id: number; likes: number }[]>`
    select pokemon_id, likes from public.pokemon_likes where likes > 0 order by pokemon_id
  `
