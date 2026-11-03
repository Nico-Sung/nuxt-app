import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp, type ErrorResponse } from '../../src/app.js'
import { PostgresWishlistStore } from '../../src/postgresStore.js'
import {
  MAX_WISHLIST_SIZE,
  type Pokemon,
  type WishlistItem,
} from '../../src/wishlist.js'
import { connectTestDatabase, resetWishlist } from './database.js'

/**
 * Routes de l'API sur une vraie base Postgres (schéma supabase/init.sql).
 * Aucun mock : chaque requête HTTP passe par le driver jusqu'à la base,
 * et on relit la table en SQL pour vérifier ce qui a vraiment été écrit.
 */

const pikachu: Pokemon = { id: 25, name: 'Pikachu', sprite: '25.png' }
const eevee: Pokemon = { id: 133, name: 'Eevee', sprite: '133.png' }
const snorlax: Pokemon = { id: 143, name: 'Snorlax', sprite: '143.png' }
/** 6 Pokémon pour remplir la liste. */
const TEAM: Pokemon[] = [1, 4, 7, 25, 39, 133].map((id) => ({
  id,
  name: `Pokemon ${id}`,
  sprite: `${id}.png`,
}))

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

let sql: postgres.Sql
let app: ReturnType<typeof createApp>

const newApp = () =>
  createApp({
    version: 'test',
    commit: 'test',
    store: new PostgresWishlistStore(sql),
  })

beforeAll(() => {
  sql = connectTestDatabase()
})

// Nettoyage : chaque test part d'une table vide.
beforeEach(async () => {
  await resetWishlist(sql)
  app = newApp()
})

afterAll(async () => {
  await resetWishlist(sql)
  await sql.end()
})

// ---------- accès HTTP ----------

const getList = async () => {
  const res = await app.request('/wishlist')
  expect(res.status).toBe(200)
  return (await res.json()) as WishlistItem[]
}

const post = (body: unknown) =>
  app.request('/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const del = (id: number) => app.request(`/wishlist/${id}`, { method: 'DELETE' })

// ---------- lecture directe de la table ----------

const dbRows = () =>
  sql<{ pokemon_id: number; name: string; sprite: string }[]>`
    select pokemon_id, name, sprite from public.wishlist order by pokemon_id
  `
const dbIds = async () => (await dbRows()).map((r) => r.pokemon_id)

// ---------- CRUD ----------

describe('CRUD sur Postgres', () => {
  it('GET : 200 et liste vide au départ', async () => {
    expect(await getList()).toEqual([])
    expect(await dbRows()).toEqual([])
  })

  it('POST : 201, entrée renvoyée et ligne écrite en base', async () => {
    const res = await post(pikachu)

    expect(res.status).toBe(201)
    expect(res.headers.get('Location')).toBe('/wishlist/25')
    const item = (await res.json()) as WishlistItem
    expect(item.pokemon).toEqual(pikachu)
    expect(item.addedAt).toMatch(ISO_DATE)

    expect(await dbRows()).toEqual([
      { pokemon_id: 25, name: 'Pikachu', sprite: '25.png' },
    ])
  })

  it('GET : renvoie les entrées en base, dans l’ordre d’ajout', async () => {
    expect((await post(eevee)).status).toBe(201)
    expect((await post(pikachu)).status).toBe(201)

    const items = await getList()
    expect(items.map((i) => i.pokemon)).toEqual([eevee, pikachu])
    for (const item of items) expect(item.addedAt).toMatch(ISO_DATE)
  })

  it('GET : lit aussi une ligne écrite directement en SQL', async () => {
    await sql`
      insert into public.wishlist (pokemon_id, name, sprite)
      values (151, 'Mew', '151.png')
    `
    const items = await getList()
    expect(items.map((i) => i.pokemon)).toEqual([
      { id: 151, name: 'Mew', sprite: '151.png' },
    ])
  })

  it('DELETE : 200, entrée renvoyée et ligne supprimée en base', async () => {
    await post(pikachu)
    await post(eevee)

    const res = await del(25)
    expect(res.status).toBe(200)
    expect(((await res.json()) as WishlistItem).pokemon).toEqual(pikachu)

    expect(await dbIds()).toEqual([133])
    expect((await getList()).map((i) => i.pokemon.id)).toEqual([133])
  })

  it('DELETE : 404 si le Pokémon est absent (ou déjà supprimé)', async () => {
    await post(pikachu)
    expect((await del(25)).status).toBe(200)

    const res = await del(25)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'Pokémon not in the list',
      code: 'not_found',
    })
    expect(await dbRows()).toEqual([])
  })

  it('persistance : une nouvelle instance de l’API voit les mêmes données', async () => {
    await post(pikachu)

    app = newApp()
    expect((await getList()).map((i) => i.pokemon)).toEqual([pikachu])
  })

  it('400 : un corps invalide n’écrit rien en base', async () => {
    const res = await post({ id: -1, name: 'Pikachu', sprite: '' })
    expect(res.status).toBe(400)
    expect(await dbRows()).toEqual([])
  })
})

// ---------- doublons ----------

describe('doublons (clé primaire)', () => {
  it('409 duplicate : un seul exemplaire en base', async () => {
    expect((await post(pikachu)).status).toBe(201)

    const res = await post({ ...pikachu, name: 'Pikachu bis' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'Pokémon already in the list',
      code: 'duplicate',
    })
    // la ligne d'origine n'est pas modifiée
    expect(await dbRows()).toEqual([
      { pokemon_id: 25, name: 'Pikachu', sprite: '25.png' },
    ])
  })

  it('liste pleine : un doublon reste signalé comme doublon', async () => {
    for (const pokemon of TEAM) expect((await post(pokemon)).status).toBe(201)

    const res = await post(pikachu)
    expect(res.status).toBe(409)
    expect(((await res.json()) as ErrorResponse).code).toBe('duplicate')
    expect(await dbRows()).toHaveLength(MAX_WISHLIST_SIZE)
  })

  it('après suppression, le même Pokémon peut être ajouté à nouveau', async () => {
    await post(pikachu)
    await del(25)
    expect((await post(pikachu)).status).toBe(201)
    expect(await dbIds()).toEqual([25])
  })
})

// ---------- limite de 6 (trigger) ----------

describe('limite de 6 (trigger Postgres)', () => {
  it('6 ajouts passent, le 7ᵉ est refusé : 409 full, 6 lignes en base', async () => {
    for (const pokemon of TEAM) expect((await post(pokemon)).status).toBe(201)

    const res = await post(snorlax)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'List full (6 max)',
      code: 'full',
    })

    expect(await dbIds()).toEqual(TEAM.map((p) => p.id))
  })

  it('après une suppression, une place se libère', async () => {
    for (const pokemon of TEAM) await post(pokemon)
    expect((await post(snorlax)).status).toBe(409)

    expect((await del(1)).status).toBe(200)
    expect((await post(snorlax)).status).toBe(201)
    expect(await dbRows()).toHaveLength(MAX_WISHLIST_SIZE)
    expect(await dbIds()).toContain(143)
  })

  it('la base refuse aussi un 7ᵉ écrit directement en SQL', async () => {
    for (const pokemon of TEAM) await post(pokemon)

    await expect(
      sql`
        insert into public.wishlist (pokemon_id, name, sprite)
        values (143, 'Snorlax', '143.png')
      `,
    ).rejects.toMatchObject({ code: '23514', message: 'Liste pleine (6 max)' })
    expect(await dbRows()).toHaveLength(MAX_WISHLIST_SIZE)
  })

  it('course réelle : 7 transactions concurrentes, exactement 6 validées', async () => {
    // 7 connexions distinctes ; chaque transaction reste ouverte un instant
    // après son insertion. Sans le verrou du trigger, toutes compteraient
    // « 0 ligne » en même temps et les 7 passeraient.
    const results = await Promise.allSettled(
      [...TEAM, snorlax].map((p) =>
        sql.begin(async (tx) => {
          await tx`
            insert into public.wishlist (pokemon_id, name, sprite)
            values (${p.id}, ${p.name}, ${p.sprite})
          `
          await tx`select pg_sleep(0.1)`
        }),
      ),
    )

    const refused = results.filter((r) => r.status === 'rejected')
    expect(refused).toHaveLength(1)
    expect(refused[0]).toMatchObject({
      reason: { code: '23514', message: 'Liste pleine (6 max)' },
    })
    expect(await dbRows()).toHaveLength(MAX_WISHLIST_SIZE)
  })

  it('7 requêtes HTTP simultanées sur une liste vide : exactement 6 acceptées', async () => {
    const candidates = [...TEAM, snorlax]

    const responses = await Promise.all(candidates.map((p) => post(p)))
    const statuses = responses.map((r) => r.status)

    expect(statuses.filter((s) => s === 201)).toHaveLength(MAX_WISHLIST_SIZE)
    expect(statuses.filter((s) => s === 409)).toHaveLength(1)
    expect(await dbRows()).toHaveLength(MAX_WISHLIST_SIZE)
  })
})
