import type { PokeApiListResponse } from '../shared/types/pokemon'
import { idFromUrl, isPokemonSlug } from '../shared/utils/pokeapi'

/**
 * Routes des fiches à générer au build (prerender) : /pokemon/<nom>.
 * Utilisé par nuxt.config.ts quand PRERENDER_POKEMON=1 (job Deploy).
 */

/** Au-delà : formes alternatives (méga, régionales…), id 10001+. */
export const MAX_DEFAULT_FORM_ID = 9999

/** Liste PokéAPI -> routes des formes par défaut, triées par numéro. */
export function pokemonRoutes(
  list: PokeApiListResponse,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  return list.results
    .map((item) => ({ id: idFromUrl(item.url), name: item.name }))
    .filter(({ id, name }) => id <= MAX_DEFAULT_FORM_ID && isPokemonSlug(name))
    .sort((a, b) => a.id - b.id)
    .slice(0, limit)
    .map(({ name }) => `/pokemon/${name}`)
}

/** Récupère la liste chez PokéAPI (réessaie 3 fois) et renvoie les routes. */
export async function fetchPokemonRoutes(
  base: string,
  options: { limit?: number; fetch?: typeof fetch; retryDelayMs?: number } = {},
): Promise<string[]> {
  const { limit, fetch: fetchFn = fetch, retryDelayMs = 1000 } = options
  const url = `${base}/pokemon?limit=100000`
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetchFn(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const routes = pokemonRoutes(
        (await response.json()) as PokeApiListResponse,
        limit,
      )
      if (!routes.length) throw new Error('aucun Pokémon dans la réponse')
      return routes
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * attempt),
        )
      }
    }
  }
  throw new Error(`Liste PokéAPI indisponible (${url}) : ${lastError}`, {
    cause: lastError,
  })
}
