import type { PokemonProfile } from '#shared/types/pokemon'
import { isAppLanguage, isPokemonSlug } from '#shared/utils/pokeapi'
import { toHttpError } from '../../../lib/pokeapi'

/** Fiche d'un Pokémon par son nom (« pikachu ») ; ?lang=fr|en (défaut : fr). */
export default defineEventHandler(async (event): Promise<PokemonProfile> => {
  const name = getRouterParam(event, 'name') ?? ''
  // Validé avant le cache : un nom impossible (espaces, majuscules…) n'existe
  // pas chez PokéAPI et ne doit jamais tomber sur la fiche d'un autre.
  if (!isPokemonSlug(name)) {
    throw createError({ statusCode: 404, statusMessage: 'Pokémon introuvable' })
  }

  try {
    const { lang } = getQuery(event)
    return await getPokemonProfile(name, isAppLanguage(lang) ? lang : 'fr')
  } catch (cause) {
    throw createError({ ...toHttpError(cause), cause })
  }
})
