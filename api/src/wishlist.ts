export interface Pokemon {
  readonly id: number
  readonly name: string
  readonly sprite: string
}

export interface WishlistItem {
  readonly pokemon: Pokemon
  /** Date d'ajout, ISO 8601. */
  readonly addedAt: string
}

/** Nombre maximum de Pokémon dans la liste (une équipe). */
export const MAX_WISHLIST_SIZE = 6

export type AddResult =
  | { readonly status: 'added'; readonly item: WishlistItem }
  | { readonly status: 'duplicate' | 'full' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Valide le corps de POST /wishlist et ne garde que les champs connus. */
export function parsePokemonInput(body: unknown): Pokemon | null {
  if (!isRecord(body)) return null
  const { id, name, sprite } = body
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null
  if (typeof name !== 'string' || name.trim() === '') return null
  if (typeof sprite !== 'string') return null
  return { id, name: name.trim(), sprite }
}

/** Stockage de la liste : en mémoire (dev, tests) ou Postgres (Supabase). */
export interface WishlistStore {
  /** Entrées dans l'ordre d'ajout. */
  list(): Promise<WishlistItem[]>
  /** Doublon prioritaire sur liste pleine. */
  add(pokemon: Pokemon): Promise<AddResult>
  /** Retire le Pokémon ; renvoie l'entrée retirée, ou null s'il était absent. */
  remove(pokemonId: number): Promise<WishlistItem | null>
}

/** Liste de Pokémon à capturer, stockée en mémoire (perdue au redémarrage). */
export class MemoryWishlistStore implements WishlistStore {
  readonly #items: WishlistItem[] = []

  /** Copie de la liste : l'appelant ne peut pas modifier le stockage. */
  async list(): Promise<WishlistItem[]> {
    return [...this.#items]
  }

  async add(pokemon: Pokemon, now: Date = new Date()): Promise<AddResult> {
    if (this.#items.some((item) => item.pokemon.id === pokemon.id)) {
      return { status: 'duplicate' }
    }
    if (this.#items.length >= MAX_WISHLIST_SIZE) {
      return { status: 'full' }
    }
    const item: WishlistItem = { pokemon, addedAt: now.toISOString() }
    this.#items.push(item)
    return { status: 'added', item }
  }

  async remove(pokemonId: number): Promise<WishlistItem | null> {
    const index = this.#items.findIndex((item) => item.pokemon.id === pokemonId)
    if (index === -1) return null
    const [removed] = this.#items.splice(index, 1)
    return removed ?? null
  }
}
