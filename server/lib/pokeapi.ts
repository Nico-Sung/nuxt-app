import type {
  Pokemon,
  PokeApiListResponse,
  PokeApiPokemonResponse,
  PokemonDetails,
} from '#shared/types/pokemon'
import { toPokemon, toPokemonDetails } from '#shared/utils/pokeapi'

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

/** PokéAPI a répondu 404. */
export class PokemonNotFoundError extends Error {
  constructor(id: number) {
    super(`Pokémon ${id} introuvable`)
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
async function getJson<T>(url: string, onNotFound?: () => Error): Promise<T> {
  let response: Response
  try {
    response = await fetch(url)
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
export async function fetchPokemonDetails(id: number): Promise<PokemonDetails> {
  const data = await getJson<PokeApiPokemonResponse>(
    `${POKEAPI_BASE}/pokemon/${id}`,
    () => new PokemonNotFoundError(id),
  )
  return toPokemonDetails(data)
}

/** Liste complète des Pokémon, triée par id. */
export async function fetchPokemonIndex(): Promise<Pokemon[]> {
  const data = await getJson<PokeApiListResponse>(
    `${POKEAPI_BASE}/pokemon?limit=100000`,
  )
  return data.results.map(toPokemon).sort((a, b) => a.id - b.id)
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
