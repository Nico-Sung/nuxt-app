import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import type { PokemonLikes } from '../../src/likes.js'
import {
  PostgresLikesStore,
  PostgresWishlistStore,
} from '../../src/postgresStore.js'
import { connectTestDatabase } from './database.js'

/** Routes /likes sur la vraie table pokemon_likes (migration 001_likes.sql). */

let sql: postgres.Sql
const newApp = () =>
  createApp({
    version: 'test',
    commit: 'test',
    store: new PostgresWishlistStore(sql),
    likes: new PostgresLikesStore(sql),
  })

const like = (app: ReturnType<typeof newApp>, id: number) =>
  app.request(`/likes/${id}`, { method: 'POST' })
const unlike = (app: ReturnType<typeof newApp>, id: number) =>
  app.request(`/likes/${id}`, { method: 'DELETE' })

const dbLikes = () =>
  sql<{ pokemon_id: number; likes: number }[]>`
    select pokemon_id, likes from public.pokemon_likes order by pokemon_id
  `

beforeAll(() => {
  sql = connectTestDatabase()
})
beforeEach(async () => {
  await sql`truncate table public.pokemon_likes, public.wishlist`
})
afterAll(async () => {
  await sql`truncate table public.pokemon_likes`
  await sql.end()
})

describe('likes sur Postgres', () => {
  it('POST écrit en base, DELETE décrémente sans passer sous 0', async () => {
    const app = newApp()
    await like(app, 25)
    await like(app, 25)
    expect(await dbLikes()).toEqual([{ pokemon_id: 25, likes: 2 }])

    await unlike(app, 25)
    await unlike(app, 25)
    const res = await unlike(app, 25)
    expect(await res.json()).toEqual({ pokemonId: 25, likes: 0 })
    expect(await dbLikes()).toEqual([{ pokemon_id: 25, likes: 0 }])
  })

  it('DELETE sur un Pokémon jamais aimé : 0, aucune ligne créée', async () => {
    const res = await unlike(newApp(), 7)
    expect(await res.json()).toEqual({ pokemonId: 7, likes: 0 })
    expect(await dbLikes()).toEqual([])
  })

  it('persistance : une nouvelle instance de l’API relit les likes', async () => {
    await like(newApp(), 143)
    const res = await newApp().request('/likes')
    expect((await res.json()) as PokemonLikes[]).toEqual([
      { pokemonId: 143, likes: 1 },
    ])
  })

  it('20 likes simultanés : aucun perdu', async () => {
    const app = newApp()
    await Promise.all(Array.from({ length: 20 }, () => like(app, 25)))
    expect(await dbLikes()).toEqual([{ pokemon_id: 25, likes: 20 }])
  })

  it('la base refuse un nombre négatif, même écrit directement', async () => {
    await expect(
      sql`insert into public.pokemon_likes (pokemon_id, likes) values (1, -1)`,
    ).rejects.toMatchObject({ code: '23514' })
  })
})
