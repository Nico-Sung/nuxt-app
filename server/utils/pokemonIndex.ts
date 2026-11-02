import type { Pokemon, PokeApiListResponse } from '#shared/types/pokemon'
import { toPokemon } from '#shared/utils/pokeapi'

const POKEAPI_URL = 'https://pokeapi.co/api/v2/pokemon?limit=100000'

/** Liste complète des Pokémon PokéAPI, mise en cache 24 h. */
export const getPokemonIndex = defineCachedFunction(
  async (): Promise<Pokemon[]> => {
    const data = await $fetch<PokeApiListResponse>(POKEAPI_URL)
    return data.results.map(toPokemon).sort((a, b) => a.id - b.id)
  },
  { name: 'pokemon-index', maxAge: 60 * 60 * 24 },
)
