import type {
  Pokemon,
  PokemonDetails,
  PokemonProfile,
} from '#shared/types/pokemon'
import { isAppLanguage } from '#shared/utils/language'
import { searchPokemonLocally } from '#shared/utils/localSearch'
import {
  PokemonNotFoundError,
  requestPokemonDetails,
  requestPokemonProfile,
} from '#shared/utils/pokeapiClient'

/**
 * Accès aux données Pokémon, selon le déploiement :
 * - SSR (Vercel, dev, E2E) : routes du serveur Nuxt /api/pokemon/… (cache serveur) ;
 * - site statique (S3 + CloudFront, `NUXT_PUBLIC_STATIC_SITE=1`) : pas de
 *   serveur, donc PokéAPI appelée directement et recherche dans le fichier
 *   des noms, sans réseau.
 * Les erreurs ont toujours un statusCode : 404 (inconnu) ou 502 (PokéAPI).
 */
export function usePokemonData() {
  const config = useRuntimeConfig().public
  const staticSite = Boolean(config.staticSite)
  const pokeapi = {
    base: config.pokeapiBase,
    // génération des pages au build : on réessaie si PokéAPI flanche
    retries: import.meta.prerender ? 2 : 0,
  }

  /** Erreur PokéAPI directe -> même forme que celles des routes serveur. */
  function asHttpError(error: unknown): never {
    throw createError({
      statusCode: error instanceof PokemonNotFoundError ? 404 : 502,
      statusMessage:
        error instanceof PokemonNotFoundError
          ? 'Pokemon introuvable'
          : 'PokeAPI indisponible',
    })
  }

  async function search(query: string): Promise<Pokemon[]> {
    if (staticSite) return searchPokemonLocally(query)
    return $fetch<Pokemon[]>('/api/pokemon/search', { query: { q: query } })
  }

  async function details(id: number): Promise<PokemonDetails> {
    if (!staticSite) return $fetch<PokemonDetails>(`/api/pokemon/${id}`)
    return requestPokemonDetails(id, pokeapi).catch(asHttpError)
  }

  async function profile(slug: string, lang: string): Promise<PokemonProfile> {
    const language = isAppLanguage(lang) ? lang : 'fr'
    if (!staticSite) {
      return $fetch<PokemonProfile>(
        `/api/pokemon/profile/${encodeURIComponent(slug)}`,
        { query: { lang: language } },
      )
    }
    return requestPokemonProfile(slug, language, pokeapi).catch(asHttpError)
  }

  return { staticSite, search, details, profile }
}
