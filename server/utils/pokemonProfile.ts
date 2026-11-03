import type { AppLanguage } from '#shared/utils/pokeapi'
import { fetchPokemonProfile } from '../lib/pokeapi'

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
    getKey: (slug: string, lang: AppLanguage) => `${lang}:${slug}`,
  },
)
