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

export const STAT_NAMES = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
] as const

export type StatName = (typeof STAT_NAMES)[number]

export const POKEMON_TYPE_NAMES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const

export type PokemonTypeName = (typeof POKEMON_TYPE_NAMES)[number]

/** Détails d'un Pokémon (stats, types…), construits à partir de GET /pokemon/{id}. */
export interface PokemonDetails {
  readonly id: number
  readonly types: readonly PokemonTypeName[]
  readonly stats: Readonly<Record<StatName, number>>
  /** En décimètres (unité PokéAPI). */
  readonly height: number
  /** En hectogrammes (unité PokéAPI). */
  readonly weight: number
}

/** Réponse brute de GET https://pokeapi.co/api/v2/pokemon/{id} (champs utilisés). */
export interface PokeApiPokemonResponse {
  id: number
  height: number
  weight: number
  types: { slot: number; type: { name: string } }[]
  stats: { base_stat: number; stat: { name: string } }[]
}
