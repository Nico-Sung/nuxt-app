import { describe, expect, it, vi } from 'vitest'
import { fetchLikes, likePokemon, unlikePokemon } from '../app/utils/likesApi'
import { WishlistApiError } from '../app/utils/wishlistApi'

const BASE = 'http://localhost:3001'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function mockFetch(impl: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('likesApi', () => {
  it('GET /likes', async () => {
    const fetchMock = mockFetch(() => json([{ pokemonId: 25, likes: 3 }]))
    await expect(fetchLikes(BASE)).resolves.toEqual([
      { pokemonId: 25, likes: 3 },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/likes',
      undefined,
    )
  })

  it('POST /likes/:id et DELETE /likes/:id renvoient le nouveau total', async () => {
    const fetchMock = mockFetch(() => json({ pokemonId: 25, likes: 4 }))
    await expect(likePokemon(BASE, 25)).resolves.toEqual({
      pokemonId: 25,
      likes: 4,
    })
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3001/likes/25',
      {
        method: 'POST',
      },
    )
    await unlikePokemon(BASE, 25)
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3001/likes/25',
      {
        method: 'DELETE',
      },
    )
  })

  it('erreurs : API injoignable, HTTP 500, réponse inattendue', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(fetchLikes(BASE)).rejects.toThrow(WishlistApiError)
    mockFetch(() => new Response('boom', { status: 500 }))
    await expect(likePokemon(BASE, 25)).rejects.toThrow(WishlistApiError)
    mockFetch(() => json({ pas: 'un tableau' }))
    await expect(fetchLikes(BASE)).rejects.toThrow('réponse inattendue')
  })
})
