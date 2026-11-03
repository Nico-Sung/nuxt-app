import type { PokemonDetails } from '#shared/types/pokemon'
import { fetchPokemonDetails, toHttpError } from '../../lib/pokeapi'

/** Détails d'un Pokémon (stats, types…), mis en cache 7 jours. */
export default defineCachedEventHandler(
  async (event): Promise<PokemonDetails> => {
    const raw = getRouterParam(event, 'id') ?? ''
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Id invalide' })
    }

    try {
      return await fetchPokemonDetails(
        Number(raw),
        useRuntimeConfig(event).pokeapiBase,
      )
    } catch (cause) {
      throw createError({ ...toHttpError(cause), cause })
    }
  },
  {
    name: 'pokemon-details',
    maxAge: 60 * 60 * 24 * 7,
    getKey: (event) => getRouterParam(event, 'id') ?? '',
  },
)
