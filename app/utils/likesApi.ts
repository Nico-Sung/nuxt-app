import { WishlistApiError } from './wishlistApi'

/** Nombre de likes d'un Pokémon (API Hono : /likes). */
export interface PokemonLikes {
  readonly pokemonId: number
  readonly likes: number
}

const url = (base: string, path: string) => `${base.replace(/\/+$/, '')}${path}`

async function call(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url(base, path), init)
  } catch (cause) {
    throw new WishlistApiError(`API injoignable (${url(base, path)})`, {
      cause,
    })
  }
  if (!res.ok) {
    throw new WishlistApiError(
      `${init?.method ?? 'GET'} ${path} : HTTP ${res.status}`,
    )
  }
  try {
    return await res.json()
  } catch (cause) {
    throw new WishlistApiError('Réponse de l’API illisible', { cause })
  }
}

/** GET /likes : Pokémon aimés et leur nombre de likes. */
export async function fetchLikes(base: string): Promise<PokemonLikes[]> {
  const data = await call(base, '/likes')
  if (!Array.isArray(data)) {
    throw new WishlistApiError('GET /likes : réponse inattendue')
  }
  return data as PokemonLikes[]
}

/** POST /likes/:id : +1, renvoie le nouveau total. */
export async function likePokemon(
  base: string,
  pokemonId: number,
): Promise<PokemonLikes> {
  return (await call(base, `/likes/${pokemonId}`, {
    method: 'POST',
  })) as PokemonLikes
}

/** DELETE /likes/:id : -1 (jamais sous 0), renvoie le nouveau total. */
export async function unlikePokemon(
  base: string,
  pokemonId: number,
): Promise<PokemonLikes> {
  return (await call(base, `/likes/${pokemonId}`, {
    method: 'DELETE',
  })) as PokemonLikes
}
