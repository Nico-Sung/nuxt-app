/** Un Pokémon tel que l'app l'utilise (construit à partir de PokéAPI). */
export interface Pokemon {
  readonly id: number
  readonly name: string
  readonly sprite: string
}

/** Entrée renvoyée par GET https://pokeapi.co/api/v2/pokemon */
export interface PokeApiListItem {
  name: string
  url: string
}

export interface PokeApiListResponse {
  count: number
  results: PokeApiListItem[]
}
