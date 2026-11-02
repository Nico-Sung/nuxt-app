import type {
  PokeApiPokemonResponse,
  PokemonDetails,
} from '#shared/types/pokemon'
import { toPokemonDetails } from '#shared/utils/pokeapi'

/** Détails d'un Pokémon (stats, types…), mis en cache 7 jours. */
export default defineCachedEventHandler(
  async (event): Promise<PokemonDetails> => {
    const raw = getRouterParam(event, 'id') ?? ''
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Id invalide' })
    }

    try {
      const data = await $fetch<PokeApiPokemonResponse>(
        `https://pokeapi.co/api/v2/pokemon/${Number(raw)}`,
      )
      return toPokemonDetails(data)
    } catch (cause) {
      const status = (cause as { statusCode?: number }).statusCode
      if (status === 404) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Pokémon introuvable',
        })
      }
      throw createError({
        statusCode: 502,
        statusMessage: 'PokéAPI indisponible',
        cause,
      })
    }
  },
  {
    name: 'pokemon-details',
    maxAge: 60 * 60 * 24 * 7,
    getKey: (event) => getRouterParam(event, 'id') ?? '',
  },
)
