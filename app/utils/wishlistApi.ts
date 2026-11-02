import type { Pokemon } from '#shared/types/pokemon'
import type { WishlistItem } from '#shared/types/wishlist'

/** API Hono injoignable, en erreur ou réponse inattendue. */
export class WishlistApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'WishlistApiError'
  }
}

export type AddStatus = 'added' | 'duplicate' | 'full'

export type AddResult =
  | { readonly status: 'added'; readonly item: WishlistItem }
  | { readonly status: 'duplicate' | 'full' }

function url(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`
}

async function request(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url(base, path), init)
  } catch (cause) {
    throw new WishlistApiError(`API injoignable (${url(base, path)})`, {
      cause,
    })
  }
}

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch (cause) {
    throw new WishlistApiError('Réponse de l’API illisible', { cause })
  }
}

/** GET /wishlist */
export async function fetchWishlist(base: string): Promise<WishlistItem[]> {
  const res = await request(base, '/wishlist')
  if (!res.ok) {
    throw new WishlistApiError(`GET /wishlist : HTTP ${res.status}`)
  }
  const data = await readJson<unknown>(res)
  if (!Array.isArray(data)) {
    throw new WishlistApiError('GET /wishlist : réponse inattendue')
  }
  return data as WishlistItem[]
}

/** POST /wishlist ; 409 -> 'duplicate' ou 'full' selon le code renvoyé par l'API. */
export async function postWishlist(
  base: string,
  pokemon: Pokemon,
): Promise<AddResult> {
  const { id, name, sprite } = pokemon
  const res = await request(base, '/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, sprite }),
  })

  if (res.status === 201) {
    return { status: 'added', item: await readJson<WishlistItem>(res) }
  }
  if (res.status === 409) {
    const { code } = await readJson<{ code?: string }>(res)
    if (code === 'duplicate' || code === 'full') return { status: code }
  }
  throw new WishlistApiError(`POST /wishlist : HTTP ${res.status}`)
}

/** DELETE /wishlist/:id ; 404 = déjà absent, considéré comme un succès. */
export async function deleteWishlist(
  base: string,
  pokemonId: number,
): Promise<void> {
  const res = await request(base, `/wishlist/${pokemonId}`, {
    method: 'DELETE',
  })
  if (res.ok || res.status === 404) return
  throw new WishlistApiError(
    `DELETE /wishlist/${pokemonId} : HTTP ${res.status}`,
  )
}
