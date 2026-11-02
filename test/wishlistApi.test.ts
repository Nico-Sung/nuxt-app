import { describe, expect, it, vi } from 'vitest'
import type { Pokemon } from '../shared/types/pokemon'
import type { WishlistItem } from '../shared/types/wishlist'
import {
  deleteWishlist,
  fetchWishlist,
  postWishlist,
  WishlistApiError,
} from '../app/utils/wishlistApi'

const BASE = 'http://localhost:3001'

const pikachu: Pokemon = { id: 25, name: 'Pikachu', sprite: '25.png' }
const pikachuItem: WishlistItem = {
  pokemon: pikachu,
  addedAt: '2026-11-02T10:00:00.000Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Remplace fetch par un mock (le garde-fou de test/setup.ts bloque tout appel non simulé). */
function mockFetch(impl: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchWishlist (GET /wishlist)', () => {
  it('200 : renvoie la liste', async () => {
    const fetchMock = mockFetch(() => json([pikachuItem]))

    await expect(fetchWishlist(BASE)).resolves.toEqual([pikachuItem])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/wishlist',
      undefined,
    )
  })

  it('tolère un / final dans l’URL de base', async () => {
    const fetchMock = mockFetch(() => json([]))
    await fetchWishlist('http://localhost:3001/')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3001/wishlist')
  })

  it('500 : lève WishlistApiError', async () => {
    mockFetch(() => new Response('boom', { status: 500 }))
    await expect(fetchWishlist(BASE)).rejects.toThrow(WishlistApiError)
  })

  it('API injoignable : lève WishlistApiError', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(fetchWishlist(BASE)).rejects.toThrow(WishlistApiError)
  })

  it('réponse qui n’est pas un tableau : lève WishlistApiError', async () => {
    mockFetch(() => json({ oops: true }))
    await expect(fetchWishlist(BASE)).rejects.toThrow(WishlistApiError)
  })
})

describe('postWishlist (POST /wishlist)', () => {
  it('201 : envoie le Pokémon en JSON et renvoie l’entrée créée', async () => {
    const fetchMock = mockFetch(() => json(pikachuItem, 201))

    await expect(postWishlist(BASE, pikachu)).resolves.toEqual({
      status: 'added',
      item: pikachuItem,
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:3001/wishlist')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual(pikachu)
  })

  it('409 duplicate : renvoie le statut "duplicate"', async () => {
    mockFetch(() =>
      json({ error: 'Pokémon déjà dans la liste', code: 'duplicate' }, 409),
    )
    await expect(postWishlist(BASE, pikachu)).resolves.toEqual({
      status: 'duplicate',
    })
  })

  it('409 full : renvoie le statut "full"', async () => {
    mockFetch(() => json({ error: 'Liste pleine (6 max)', code: 'full' }, 409))
    await expect(postWishlist(BASE, pikachu)).resolves.toEqual({
      status: 'full',
    })
  })

  it('400 : lève WishlistApiError', async () => {
    mockFetch(() =>
      json({ error: 'Corps invalide', code: 'invalid_body' }, 400),
    )
    await expect(postWishlist(BASE, pikachu)).rejects.toThrow(WishlistApiError)
  })

  it('API injoignable : lève WishlistApiError', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(postWishlist(BASE, pikachu)).rejects.toThrow(WishlistApiError)
  })
})

describe('deleteWishlist (DELETE /wishlist/:id)', () => {
  it('200 : supprime', async () => {
    const fetchMock = mockFetch(() => json(pikachuItem))

    await expect(deleteWishlist(BASE, 25)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/wishlist/25',
      {
        method: 'DELETE',
      },
    )
  })

  it('404 : déjà absent, considéré comme un succès', async () => {
    mockFetch(() =>
      json({ error: 'Pokémon absent de la liste', code: 'not_found' }, 404),
    )
    await expect(deleteWishlist(BASE, 25)).resolves.toBeUndefined()
  })

  it('500 : lève WishlistApiError', async () => {
    mockFetch(() => new Response('boom', { status: 500 }))
    await expect(deleteWishlist(BASE, 25)).rejects.toThrow(WishlistApiError)
  })
})
