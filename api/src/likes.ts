/** Nombre de likes d'un Pokémon. */
export interface PokemonLikes {
  readonly pokemonId: number
  readonly likes: number
}

/** Stockage des likes : en mémoire (dev, tests) ou Postgres (table pokemon_likes). */
export interface LikesStore {
  /** Pokémon ayant au moins un like, par numéro. */
  list(): Promise<PokemonLikes[]>
  /** +1 (atomique). */
  like(pokemonId: number): Promise<PokemonLikes>
  /** -1, jamais en dessous de 0. */
  unlike(pokemonId: number): Promise<PokemonLikes>
}

export class MemoryLikesStore implements LikesStore {
  readonly #likes = new Map<number, number>()

  async list(): Promise<PokemonLikes[]> {
    return [...this.#likes]
      .filter(([, likes]) => likes > 0)
      .sort(([a], [b]) => a - b)
      .map(([pokemonId, likes]) => ({ pokemonId, likes }))
  }

  async like(pokemonId: number): Promise<PokemonLikes> {
    const likes = (this.#likes.get(pokemonId) ?? 0) + 1
    this.#likes.set(pokemonId, likes)
    return { pokemonId, likes }
  }

  async unlike(pokemonId: number): Promise<PokemonLikes> {
    const likes = Math.max((this.#likes.get(pokemonId) ?? 0) - 1, 0)
    this.#likes.set(pokemonId, likes)
    return { pokemonId, likes }
  }
}
