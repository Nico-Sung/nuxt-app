import { fetchPokemonProfile } from '../lib/pokeapi'

/**
 * Fiche d'un Pokémon, mise en cache 7 jours. Le nom doit être validé avant
 * (isPokemonSlug) : la route n'appelle le cache qu'avec un nom PokéAPI valide.
 */
export const getPokemonProfile = defineCachedFunction(
  (slug: string) => fetchPokemonProfile(slug, useRuntimeConfig().pokeapiBase),
  {
    name: 'pokemon-profile',
    maxAge: 60 * 60 * 24 * 7,
    getKey: (slug: string) => slug,
  },
)
