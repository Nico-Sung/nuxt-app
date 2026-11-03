import postgres from 'postgres'
import type {
  AddResult,
  Pokemon,
  WishlistItem,
  WishlistStore,
} from './wishlist.js'

/** Codes d'erreur Postgres levés par le schéma (supabase/init.sql). */
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

/** Connexion à partir d'une URL (Supabase, ou la base de test locale). */
export function connect(url: string): postgres.Sql {
  return postgres(url, {
    // Compatible avec le pooler Supabase en mode transaction.
    prepare: false,
    onnotice: () => {},
  })
}
