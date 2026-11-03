import type {
  Pokemon,
  PokeApiListResponse,
  PokeApiPokemonProfileResponse,
  PokeApiPokemonResponse,
  PokeApiSpeciesResponse,
  PokemonDetails,
  PokemonProfile,
} from '../types/pokemon'
import type { AppLanguage } from './language'
import {
  idFromUrl,
  toPokemon,
  toPokemonDetails,
  toPokemonProfile,
} from './pokeapi'

/**
 * Client PokéAPI utilisable partout : routes serveur Nuxt (SSR, Vercel) et
 * navigateur (site statique S3 + CloudFront, sans serveur). PokéAPI autorise
 * les appels depuis n'importe quelle origine (CORS ouvert).
 */

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

export interface PokeApiOptions {
  /** URL de PokéAPI (défaut : pokeapi.co ; un faux serveur dans les tests E2E). */
  base?: string
  /** Nouvelles tentatives si PokéAPI répond 429/5xx ou est injoignable. */
  retries?: number
}

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

const isTransient = (status: number) => status === 429 || status >= 500

async function fetchWithRetry(url: string, retries: number): Promise<Response> {
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

/** GET JSON sur PokéAPI ; 404 -> `onNotFound()`, tout autre échec -> PokeApiUnavailableError. */
async function getJson<T>(
  url: string,
  retries: number,
  onNotFound?: () => Error,
): Promise<T> {
  let response: Response
  try {
    response = await fetchWithRetry(url, retries)
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
export async function requestPokemonDetails(
  id: number,
  { base = POKEAPI_BASE, retries = 0 }: PokeApiOptions = {},
): Promise<PokemonDetails> {
  const data = await getJson<PokeApiPokemonResponse>(
    `${base}/pokemon/${id}`,
    retries,
    () => new PokemonNotFoundError(id),
  )
  return toPokemonDetails(data)
}

/** Liste complète des Pokémon, triée par id. */
export async function requestPokemonIndex({
  base = POKEAPI_BASE,
  retries = 0,
}: PokeApiOptions = {}): Promise<Pokemon[]> {
  const data = await getJson<PokeApiListResponse>(
    `${base}/pokemon?limit=100000`,
    retries,
  )
  return data.results.map(toPokemon).sort((a, b) => a.id - b.id)
}

/**
 * Fiche d'un Pokémon par son nom PokéAPI ("pikachu").
 * L'espèce (catégorie, description) est facultative : si elle échoue,
 * la fiche est renvoyée sans ces deux champs plutôt que pas du tout.
 */
export async function requestPokemonProfile(
  slug: string,
  lang: AppLanguage = 'fr',
  { base = POKEAPI_BASE, retries = 0 }: PokeApiOptions = {},
): Promise<PokemonProfile> {
  const data = await getJson<PokeApiPokemonProfileResponse>(
    `${base}/pokemon/${encodeURIComponent(slug)}`,
    retries,
    () => new PokemonNotFoundError(slug),
  )

  let species: PokeApiSpeciesResponse | null
  try {
    species = await getJson<PokeApiSpeciesResponse>(
      `${base}/pokemon-species/${idFromUrl(data.species.url)}`,
      retries,
    )
  } catch {
    species = null
  }

  return toPokemonProfile(data, species, lang)
}
