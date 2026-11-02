import type { Pokemon, PokeApiListResponse } from '#shared/types/pokemon'
import { toPokemon } from '#shared/utils/pokeapi'

const POKEAPI_URL = 'https://pokeapi.co/api/v2/pokemon?limit=151'

export default defineCachedEventHandler(
  async (): Promise<Pokemon[]> => {
    try {
      const data = await $fetch<PokeApiListResponse>(POKEAPI_URL)
      return data.results.map(toPokemon).sort((a, b) => a.id - b.id)
    }
    catch (cause) {
      throw createError({
        statusCode: 502,
        statusMessage: 'PokéAPI indisponible',
        cause,
      })
    }
  },
  { name: 'pokemon-list', maxAge: 60 * 60 * 24 },
)
