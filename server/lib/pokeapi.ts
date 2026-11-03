import type {
  Pokemon,
  PokemonDetails,
  PokemonProfile,
} from '#shared/types/pokemon'
import type { AppLanguage } from '#shared/utils/language'
import {
  POKEAPI_BASE,
  PokemonNotFoundError,
  requestPokemonDetails,
  requestPokemonIndex,
  requestPokemonProfile,
} from '#shared/utils/pokeapiClient'

export {
  POKEAPI_BASE,
  PokeApiUnavailableError,
  PokemonNotFoundError,
} from '#shared/utils/pokeapiClient'

/**
 * Pendant la génération des fiches au build (~2 000 appels), une erreur
 * passagère de PokéAPI ne doit pas faire échouer tout le déploiement :
 * 2 nouvelles tentatives. À l'exécution, aucune (réponse rapide).
 */
const retries = () => (import.meta.prerender ? 2 : 0)

/** Détails (stats, types…) d'un Pokémon. */
export function fetchPokemonDetails(
  id: number,
  base = POKEAPI_BASE,
): Promise<PokemonDetails> {
  return requestPokemonDetails(id, { base, retries: retries() })
}

/** Liste complète des Pokémon, triée par id. */
export function fetchPokemonIndex(base = POKEAPI_BASE): Promise<Pokemon[]> {
  return requestPokemonIndex({ base, retries: retries() })
}

/** Fiche d'un Pokémon par son nom PokéAPI ("pikachu"). */
export function fetchPokemonProfile(
  slug: string,
  base = POKEAPI_BASE,
  lang: AppLanguage = 'fr',
): Promise<PokemonProfile> {
  return requestPokemonProfile(slug, lang, { base, retries: retries() })
}

/** Traduit une erreur PokéAPI en réponse HTTP de notre API. */
export function toHttpError(error: unknown): {
  statusCode: number
  statusMessage: string
} {
  if (error instanceof PokemonNotFoundError) {
    return { statusCode: 404, statusMessage: 'Pokémon introuvable' }
  }
  return { statusCode: 502, statusMessage: 'PokéAPI indisponible' }
}
