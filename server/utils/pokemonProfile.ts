import type { AppLanguage } from '#shared/utils/language'
import { fetchPokemonProfile } from '../lib/pokeapi'

/** v2 : ajout de `lang`. */
const PROFILE_CACHE_VERSION = 2

/**
 * Fiche d'un Pokémon dans une langue, mise en cache 7 jours. Le nom doit être
 * validé avant (isPokemonSlug) : la route n'appelle le cache qu'avec un nom valide.
 */
export const getPokemonProfile = defineCachedFunction(
  (slug: string, lang: AppLanguage) =>
    fetchPokemonProfile(slug, useRuntimeConfig().pokeapiBase, lang),
  {
    name: 'pokemon-profile',
    maxAge: 60 * 60 * 24 * 7,
    // Version des données dans la clé : à incrémenter quand PokemonProfile
    // change, sinon un cache encore valide (7 j) servirait l'ancienne forme.
    getKey: (slug: string, lang: AppLanguage) =>
      `v${PROFILE_CACHE_VERSION}:${lang}:${slug}`,
  },
)
