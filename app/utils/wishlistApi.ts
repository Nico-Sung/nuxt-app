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

/** Ajoute la langue de l'interface (messages d'erreur de l'API dans cette langue). */
function withLanguage(
  init: RequestInit | undefined,
  lang: string | undefined,
): RequestInit | undefined {
  if (!lang) return init
  return {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      'Accept-Language': lang,
    },
  }
}

async function request(
  base: string,
  path: string,
  init?: RequestInit,
  lang?: string,
): Promise<Response> {
  try {
    return await fetch(url(base, path), withLanguage(init, lang))
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
export async function fetchWishlist(
  base: string,
  lang?: string,
): Promise<WishlistItem[]> {
  const res = await request(base, '/wishlist', undefined, lang)
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
  lang?: string,
): Promise<AddResult> {
  const { id, name, sprite } = pokemon
  const res = await request(
    base,
    '/wishlist',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, sprite }),
    },
    lang,
  )

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
  lang?: string,
): Promise<void> {
  const res = await request(
    base,
    `/wishlist/${pokemonId}`,
    { method: 'DELETE' },
    lang,
  )
  if (res.ok || res.status === 404) return
  throw new WishlistApiError(
    `DELETE /wishlist/${pokemonId} : HTTP ${res.status}`,
  )
}
