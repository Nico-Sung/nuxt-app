export interface Pokemon {
  id: number
  name: string
  sprite: string
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
