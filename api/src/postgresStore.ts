import postgres from 'postgres'
import type { LikesStore, PokemonLikes } from './likes.js'
import type {
  AddResult,
  Pokemon,
  WishlistItem,
  WishlistStore,
} from './wishlist.js'

/** Codes d'erreur Postgres levés par le schéma (supabase/migrations/000_init.sql). */
const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'

interface WishlistRow {
  pokemon_id: number
  name: string
  sprite: string
  added_at: Date | string
}

const toItem = (row: WishlistRow): WishlistItem => ({
  pokemon: { id: row.pokemon_id, name: row.name, sprite: row.sprite },
  addedAt: new Date(row.added_at).toISOString(),
})

const isPostgresError = (error: unknown): error is postgres.PostgresError =>
  error instanceof postgres.PostgresError

/**
 * Liste stockée dans la table public.wishlist.
 * Les règles (doublon, 6 max) sont appliquées par la base, pas ici :
 * on traduit seulement ses erreurs.
 */
export class PostgresWishlistStore implements WishlistStore {
  readonly #sql: postgres.Sql

  constructor(sql: postgres.Sql) {
    this.#sql = sql
  }

  async list(): Promise<WishlistItem[]> {
    const rows = await this.#sql<WishlistRow[]>`
      select pokemon_id, name, sprite, added_at
      from public.wishlist
      order by added_at, pokemon_id
    `
    return rows.map(toItem)
  }

  async add(pokemon: Pokemon): Promise<AddResult> {
    try {
      const [row] = await this.#sql<WishlistRow[]>`
        insert into public.wishlist (pokemon_id, name, sprite)
        values (${pokemon.id}, ${pokemon.name}, ${pokemon.sprite})
        returning pokemon_id, name, sprite, added_at
      `
      if (!row) throw new Error('insert sans ligne renvoyée')
      return { status: 'added', item: toItem(row) }
    } catch (error) {
      if (isPostgresError(error)) {
        if (error.code === UNIQUE_VIOLATION) return { status: 'duplicate' }
        // Le trigger « 6 max » n'est rattaché à aucune contrainte nommée ;
        // une autre contrainte CHECK violée est un vrai bug (→ 500).
        if (error.code === CHECK_VIOLATION && !error.constraint_name) {
          return { status: 'full' }
        }
      }
      throw error
    }
  }

  async remove(pokemonId: number): Promise<WishlistItem | null> {
    const [row] = await this.#sql<WishlistRow[]>`
      delete from public.wishlist
      where pokemon_id = ${pokemonId}
      returning pokemon_id, name, sprite, added_at
    `
    return row ? toItem(row) : null
  }
}

/**
 * Likes stockés dans public.pokemon_likes (migration 001_likes.sql).
 * Chaque +1/-1 est une seule requête SQL : pas de perte si deux visiteurs
 * likent en même temps.
 */
export class PostgresLikesStore implements LikesStore {
  readonly #sql: postgres.Sql

  constructor(sql: postgres.Sql) {
    this.#sql = sql
  }

  async list(): Promise<PokemonLikes[]> {
    const rows = await this.#sql<{ pokemon_id: number; likes: number }[]>`
      select pokemon_id, likes from public.pokemon_likes
      where likes > 0
      order by pokemon_id
    `
    return rows.map((r) => ({ pokemonId: r.pokemon_id, likes: r.likes }))
  }

  async like(pokemonId: number): Promise<PokemonLikes> {
    const [row] = await this.#sql<{ likes: number }[]>`
      insert into public.pokemon_likes (pokemon_id, likes)
      values (${pokemonId}, 1)
      on conflict (pokemon_id) do update
        set likes = public.pokemon_likes.likes + 1, updated_at = now()
      returning likes
    `
    return { pokemonId, likes: row?.likes ?? 0 }
  }

  async unlike(pokemonId: number): Promise<PokemonLikes> {
    const [row] = await this.#sql<{ likes: number }[]>`
      update public.pokemon_likes
      set likes = greatest(likes - 1, 0), updated_at = now()
      where pokemon_id = ${pokemonId}
      returning likes
    `
    return { pokemonId, likes: row?.likes ?? 0 }
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Hôte de la base, pour les logs (jamais l'URL complète : elle contient le mot de passe). */
export function databaseHost(url: string): string {
  return new URL(url).hostname
}

/** Exécuté dans AWS Lambda : une requête à la fois par instance. */
const isLambda = () => Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)

/** Connexion à partir d'une URL (Supabase, ou la base de test locale). */
export function connect(url: string): postgres.Sql {
  return postgres(url, {
    // Compatible avec le pooler Supabase en mode transaction.
    prepare: false,
    // Lambda : une seule connexion par instance, réutilisée entre les requêtes
    // et fermée après 20 s d'inactivité (l'instance peut être gelée longtemps).
    ...(isLambda() ? { max: 1, idle_timeout: 20 } : {}),
    // Chiffrement obligatoire hors de la machine (Supabase) ; pas en local (Docker).
    ssl: LOCAL_HOSTS.has(databaseHost(url)) ? false : 'require',
    onnotice: () => {},
  })
}
