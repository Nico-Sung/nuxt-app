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

/** Talent d'un Pokémon (nom anglais formaté). */
export interface PokemonAbility {
  readonly name: string
  /** Talent caché (obtenu sous conditions). */
  readonly hidden: boolean
}

/** Fiche complète d'un Pokémon : page /pokemon/[name]. */
export interface PokemonProfile extends PokemonDetails {
  /** Nom PokéAPI, utilisé dans l'URL : "mr-mime". */
  readonly slug: string
  /** Nom affiché : "Mr Mime". */
  readonly name: string
  readonly sprite: string
  /** Catégorie, ex. « Pokémon Souris » ; null si indisponible. */
  readonly genus: string | null
  /** Description du Pokédex (français, sinon anglais) ; null si indisponible. */
  readonly description: string | null
  readonly abilities: readonly PokemonAbility[]
}

/** Réponse brute de GET /pokemon/{name} avec les champs de la fiche. */
export interface PokeApiPokemonProfileResponse extends PokeApiPokemonResponse {
  name: string
  species: { name: string; url: string }
  abilities: { ability: { name: string }; is_hidden: boolean; slot: number }[]
}

/** Texte traduit renvoyé par PokéAPI. */
export interface PokeApiLocalized {
  language: { name: string }
}

/** Réponse brute de GET /pokemon-species/{id} (champs utilisés). */
export interface PokeApiSpeciesResponse {
  genera: (PokeApiLocalized & { genus: string })[]
  flavor_text_entries: (PokeApiLocalized & { flavor_text: string })[]
}
