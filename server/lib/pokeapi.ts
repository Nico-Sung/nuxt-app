import type {
  Pokemon,
  PokeApiListResponse,
  PokeApiPokemonProfileResponse,
  PokeApiPokemonResponse,
  PokeApiSpeciesResponse,
  PokemonDetails,
  PokemonProfile,
} from '#shared/types/pokemon'
import type { AppLanguage } from '#shared/utils/language'
import {
  idFromUrl,
  toPokemon,
  toPokemonDetails,
  toPokemonProfile,
} from '#shared/utils/pokeapi'

/** URL par défaut ; surchargeable (runtimeConfig.pokeapiBase / NUXT_POKEAPI_BASE). */
export const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

/** PokéAPI a répondu 404. */
export class PokemonNotFoundError extends Error {
  constructor(idOrName: number | string) {
    super(`Pokémon ${idOrName} introuvable`)
    this.name = 'PokemonNotFoundError'
  }
}

/** PokéAPI injoignable, en erreur (5xx…) ou réponse illisible. */
export class PokeApiUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PokeApiUnavailableError'
  }
}

/** GET JSON sur PokéAPI ; 404 -> `onNotFound()`, tout autre échec -> PokeApiUnavailableError. */
/**
 * Pendant la génération des fiches au build (~2 000 appels), une erreur
 * passagère de PokéAPI ne doit pas faire échouer tout le déploiement :
 * 2 nouvelles tentatives. À l'exécution, aucune (réponse rapide).
 */
const PRERENDER_RETRIES = 2

const isTransient = (status: number) => status === 429 || status >= 500

async function fetchWithRetry(url: string): Promise<Response> {
  const retries = import.meta.prerender ? PRERENDER_RETRIES : 0
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url)
      if (!isTransient(response.status) || attempt >= retries) return response
    } catch (cause) {
      if (attempt >= retries) throw cause
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  }
}

async function getJson<T>(url: string, onNotFound?: () => Error): Promise<T> {
  let response: Response
  try {
    response = await fetchWithRetry(url)
  } catch (cause) {
    throw new PokeApiUnavailableError(`PokéAPI injoignable (${url})`, {
      cause,
    })
  }

  if (response.status === 404 && onNotFound) throw onNotFound()
  if (!response.ok) {
    throw new PokeApiUnavailableError(
      `PokéAPI a répondu ${response.status} (${url})`,
    )
  }

  try {
    return (await response.json()) as T
  } catch (cause) {
    throw new PokeApiUnavailableError(`Réponse PokéAPI illisible (${url})`, {
      cause,
    })
  }
}

/** Détails (stats, types…) d'un Pokémon. */
export async function fetchPokemonDetails(
  id: number,
  base = POKEAPI_BASE,
): Promise<PokemonDetails> {
  const data = await getJson<PokeApiPokemonResponse>(
    `${base}/pokemon/${id}`,
    () => new PokemonNotFoundError(id),
  )
  return toPokemonDetails(data)
}

/** Liste complète des Pokémon, triée par id. */
export async function fetchPokemonIndex(
  base = POKEAPI_BASE,
): Promise<Pokemon[]> {
  const data = await getJson<PokeApiListResponse>(
    `${base}/pokemon?limit=100000`,
  )
  return data.results.map(toPokemon).sort((a, b) => a.id - b.id)
}

/**
 * Fiche d'un Pokémon par son nom PokéAPI ("pikachu").
 * L'espèce (catégorie, description) est facultative : si elle échoue,
 * la fiche est renvoyée sans ces deux champs plutôt que pas du tout.
 */
export async function fetchPokemonProfile(
  slug: string,
  base = POKEAPI_BASE,
  lang: AppLanguage = 'fr',
): Promise<PokemonProfile> {
  const data = await getJson<PokeApiPokemonProfileResponse>(
    `${base}/pokemon/${encodeURIComponent(slug)}`,
    () => new PokemonNotFoundError(slug),
  )

  let species: PokeApiSpeciesResponse | null
  try {
    species = await getJson<PokeApiSpeciesResponse>(
      `${base}/pokemon-species/${idFromUrl(data.species.url)}`,
    )
  } catch {
    species = null
  }

  return toPokemonProfile(data, species, lang)
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
