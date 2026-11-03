import type { PokemonProfile } from '#shared/types/pokemon'
import { isPokemonSlug } from '#shared/utils/pokeapi'
import { toHttpError } from '../../../lib/pokeapi'

/** Fiche d'un Pokémon par son nom (« pikachu »). */
export default defineEventHandler(async (event): Promise<PokemonProfile> => {
  const name = getRouterParam(event, 'name') ?? ''
  // Validé avant le cache : un nom impossible (espaces, majuscules…) n'existe
  // pas chez PokéAPI et ne doit jamais tomber sur la fiche d'un autre.
  if (!isPokemonSlug(name)) {
    throw createError({ statusCode: 404, statusMessage: 'Pokémon introuvable' })
  }

  try {
    return await getPokemonProfile(name)
  } catch (cause) {
    throw createError({ ...toHttpError(cause), cause })
  }
})
