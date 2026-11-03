import { describe, expect, it } from 'vitest'
import { createApp, type ErrorResponse } from '../src/app.js'
import type { PokemonLikes } from '../src/likes.js'

const newApp = () => createApp({ version: 'test', commit: 'test' })

const like = (app: ReturnType<typeof newApp>, id: number | string) =>
  app.request(`/likes/${id}`, { method: 'POST' })
const unlike = (app: ReturnType<typeof newApp>, id: number | string) =>
  app.request(`/likes/${id}`, { method: 'DELETE' })
const list = async (app: ReturnType<typeof newApp>) =>
  (await (await app.request('/likes')).json()) as PokemonLikes[]

describe('likes (API, stockage en mémoire)', () => {
  it('GET /likes : 200 et liste vide au départ', async () => {
    const res = await newApp().request('/likes')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('POST /likes/:id : +1 à chaque appel, renvoie le total', async () => {
    const app = newApp()
    expect(await (await like(app, 25)).json()).toEqual({
      pokemonId: 25,
      likes: 1,
    })
    const res = await like(app, 25)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ pokemonId: 25, likes: 2 })
  })

  it('DELETE /likes/:id : -1, jamais en dessous de 0', async () => {
    const app = newApp()
    await like(app, 25)
    expect(await (await unlike(app, 25)).json()).toEqual({
      pokemonId: 25,
      likes: 0,
    })
    expect(await (await unlike(app, 25)).json()).toEqual({
      pokemonId: 25,
      likes: 0,
    })
    expect(await (await unlike(app, 7)).json()).toEqual({
      pokemonId: 7,
      likes: 0,
    })
  })

  it('GET /likes : seulement les Pokémon aimés, triés par numéro', async () => {
    const app = newApp()
    await like(app, 143)
    await like(app, 25)
    await like(app, 25)
    await like(app, 7)
    await unlike(app, 7)
    expect(await list(app)).toEqual([
      { pokemonId: 25, likes: 2 },
      { pokemonId: 143, likes: 1 },
    ])
  })

  it.each(['abc', '0', '-1', '2.5'])('400 : id invalide (%s)', async (id) => {
    for (const res of [await like(newApp(), id), await unlike(newApp(), id)]) {
      expect(res.status).toBe(400)
      expect(((await res.json()) as ErrorResponse).code).toBe('invalid_id')
    }
  })

  it('les likes sont indépendants de la liste', async () => {
    const app = newApp()
    await like(app, 25)
    expect(await (await app.request('/wishlist')).json()).toEqual([])
  })
})
