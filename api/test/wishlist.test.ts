import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, type ErrorResponse } from '../src/app.js'
import {
  MAX_WISHLIST_SIZE,
  type Pokemon,
  type WishlistItem,
} from '../src/wishlist.js'

const pikachu: Pokemon = { id: 25, name: 'Pikachu', sprite: '25.png' }
const eevee: Pokemon = { id: 133, name: 'Eevee', sprite: '133.png' }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** Nouvelle app avec une liste vide pour chaque test. */
let app: ReturnType<typeof createApp>
beforeEach(() => {
  app = createApp({ version: 'test', commit: 'test' })
})

const getList = () => app.request('/wishlist')

const post = (body: unknown) =>
  app.request('/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const del = (id: string | number) =>
  app.request(`/wishlist/${id}`, { method: 'DELETE' })

describe('GET /wishlist', () => {
  it('200 : liste vide au départ', async () => {
    const res = await getList()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('200 : contient les Pokémon ajoutés, dans l’ordre', async () => {
    await post(pikachu)
    await post(eevee)

    const res = await getList()
    expect(res.status).toBe(200)
    const items = (await res.json()) as WishlistItem[]
    expect(items.map((i) => i.pokemon)).toEqual([pikachu, eevee])
  })
})

describe('POST /wishlist', () => {
  it('201 : ajoute le Pokémon et renvoie l’entrée créée', async () => {
    const res = await post(pikachu)

    expect(res.status).toBe(201)
    expect(res.headers.get('Location')).toBe('/wishlist/25')
    const item = (await res.json()) as WishlistItem
    expect(item.pokemon).toEqual(pikachu)
    expect(item.addedAt).toMatch(ISO_DATE)
  })

  it('ignore les champs inconnus du corps', async () => {
    const res = await post({ ...pikachu, hacker: true })
    const item = (await res.json()) as WishlistItem
    expect(item.pokemon).toEqual(pikachu)
  })

  it('409 : refuse un doublon sans modifier la liste', async () => {
    await post(pikachu)
    const res = await post(pikachu)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'Pokémon déjà dans la liste',
    })
    expect(await (await getList()).json()).toHaveLength(1)
  })

  it('409 : refuse un 7ᵉ Pokémon (règle des 6)', async () => {
    for (let id = 1; id <= MAX_WISHLIST_SIZE; id++) {
      const res = await post({ id, name: `Pokemon ${id}`, sprite: '' })
      expect(res.status).toBe(201)
    }

    const res = await post(pikachu)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'Liste pleine (6 max)',
    })
    expect(await (await getList()).json()).toHaveLength(6)
  })

  it.each([
    ['id manquant', { name: 'Pikachu', sprite: '' }],
    ['id non entier', { id: 2.5, name: 'Pikachu', sprite: '' }],
    ['id négatif', { id: -1, name: 'Pikachu', sprite: '' }],
    ['nom vide', { id: 25, name: '  ', sprite: '' }],
    ['sprite manquant', { id: 25, name: 'Pikachu' }],
    ['tableau', [pikachu]],
    ['JSON mal formé', '{pas du json'],
  ])('400 : corps invalide (%s)', async (_label, body) => {
    const res = await post(body)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual<ErrorResponse>({ error: 'Corps invalide' })
    expect(await (await getList()).json()).toEqual([])
  })
})

describe('DELETE /wishlist/:id', () => {
  it('200 : retire le Pokémon et renvoie l’entrée supprimée', async () => {
    await post(pikachu)
    await post(eevee)

    const res = await del(25)
    expect(res.status).toBe(200)
    expect(((await res.json()) as WishlistItem).pokemon).toEqual(pikachu)

    const items = (await (await getList()).json()) as WishlistItem[]
    expect(items.map((i) => i.pokemon.id)).toEqual([133])
  })

  it('404 : Pokémon absent de la liste', async () => {
    const res = await del(999)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'Pokémon absent de la liste',
    })
  })

  it('404 : déjà supprimé', async () => {
    await post(pikachu)
    expect((await del(25)).status).toBe(200)
    expect((await del(25)).status).toBe(404)
  })

  it.each(['abc', '0', '-1', '2.5'])('400 : id invalide (%s)', async (id) => {
    const res = await del(id)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual<ErrorResponse>({ error: 'Id invalide' })
  })
})

describe('isolation', () => {
  it('deux apps ne partagent pas leur liste', async () => {
    const other = createApp({ version: 'test', commit: 'test' })
    await post(pikachu)

    expect(await (await other.request('/wishlist')).json()).toEqual([])
  })

  it('une app partage sa liste entre les requêtes', async () => {
    await post(pikachu)
    await post(eevee)
    expect(await (await getList()).json()).toHaveLength(2)
  })
})
