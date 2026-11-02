import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../shared/types/pokemon'
import type { WishlistItem } from '../shared/types/wishlist'
import {
  addToWishlist,
  isWishlistFull,
  MAX_WISHLIST_SIZE,
  parseStoredWishlist,
  removeFromWishlist,
  sortByMostRecent,
} from '../app/utils/wishlist'

const pikachu: Pokemon = { id: 25, name: 'Pikachu', sprite: '25.png' }
const eevee: Pokemon = { id: 133, name: 'Eevee', sprite: '133.png' }

const DAY_1 = new Date('2026-11-01T10:00:00.000Z')
const DAY_2 = new Date('2026-11-02T10:00:00.000Z')

const item = (pokemon: Pokemon, date: Date): WishlistItem => ({
  pokemon,
  addedAt: date.toISOString(),
})

/** Pokémon factice d'id donné. */
const poke = (id: number): Pokemon => ({
  id,
  name: `Pokemon ${id}`,
  sprite: `${id}.png`,
})

/** Liste de `count` Pokémon (ids 1..count). */
const listOf = (count: number): WishlistItem[] =>
  Array.from({ length: count }, (_, i) => item(poke(i + 1), DAY_1))

describe('addToWishlist', () => {
  describe('ajout', () => {
    it('ajoute une entrée datée', () => {
      const result = addToWishlist([], pikachu, DAY_1)
      expect(result.status).toBe('added')
      expect(result.list).toEqual([
        { pokemon: pikachu, addedAt: '2026-11-01T10:00:00.000Z' },
      ])
    })

    it('ajoute à la fin sans modifier le tableau reçu', () => {
      const list = [item(pikachu, DAY_1)]
      const result = addToWishlist(list, eevee, DAY_2)
      expect(result.list).toEqual([item(pikachu, DAY_1), item(eevee, DAY_2)])
      expect(list).toHaveLength(1)
      expect(result.list).not.toBe(list)
    })
  })

  describe('doublon', () => {
    it('refuse un Pokémon déjà présent', () => {
      const list = [item(pikachu, DAY_1)]
      const result = addToWishlist(list, { ...pikachu }, DAY_2)
      expect(result.status).toBe('duplicate')
      expect(result.list).toEqual(list)
    })

    it('signale le doublon même quand la liste est pleine', () => {
      const full = listOf(MAX_WISHLIST_SIZE)
      const result = addToWishlist(full, poke(1), DAY_2)
      expect(result.status).toBe('duplicate')
      expect(result.list).toEqual(full)
    })
  })

  describe('liste pleine', () => {
    it('refuse un 7ᵉ Pokémon', () => {
      const full = listOf(6)
      const result = addToWishlist(full, pikachu, DAY_2)
      expect(result.status).toBe('full')
      expect(result.list).toHaveLength(6)
      expect(result.list.some((i) => i.pokemon.id === pikachu.id)).toBe(false)
    })

    it('ne modifie pas la liste pleine reçue', () => {
      const full = listOf(6)
      addToWishlist(full, pikachu, DAY_2)
      expect(full).toEqual(listOf(6))
    })
  })

  describe('règle des 6 Pokémon', () => {
    it('limite la liste à 6', () => {
      expect(MAX_WISHLIST_SIZE).toBe(6)
    })

    it('accepte le 6ᵉ Pokémon', () => {
      const result = addToWishlist(listOf(5), pikachu, DAY_2)
      expect(result.status).toBe('added')
      expect(result.list).toHaveLength(6)
    })

    it('accepte 6 ajouts successifs puis refuse le 7ᵉ', () => {
      let list: WishlistItem[] = []
      const statuses: string[] = []
      for (let id = 1; id <= 7; id++) {
        const result = addToWishlist(list, poke(id), DAY_1)
        statuses.push(result.status)
        list = result.list
      }
      expect(statuses).toEqual([
        'added',
        'added',
        'added',
        'added',
        'added',
        'added',
        'full',
      ])
      expect(list.map((i) => i.pokemon.id)).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('isWishlistFull vaut true à partir de 6', () => {
      expect(isWishlistFull(listOf(5))).toBe(false)
      expect(isWishlistFull(listOf(6))).toBe(true)
    })
  })
})

describe('removeFromWishlist', () => {
  it('retire la bonne entrée', () => {
    const list = [item(pikachu, DAY_1), item(eevee, DAY_2)]
    expect(removeFromWishlist(list, 25)).toEqual([item(eevee, DAY_2)])
  })

  it("ne change rien si l'id est absent", () => {
    const list = [item(pikachu, DAY_1)]
    expect(removeFromWishlist(list, 999)).toEqual(list)
  })
})

describe('sortByMostRecent', () => {
  it('met les derniers ajoutés en premier sans modifier la liste', () => {
    const list = [item(pikachu, DAY_1), item(eevee, DAY_2)]
    expect(sortByMostRecent(list).map((i) => i.pokemon.name)).toEqual([
      'Eevee',
      'Pikachu',
    ])
    expect(list[0]?.pokemon.name).toBe('Pikachu')
  })
})

describe('parseStoredWishlist', () => {
  it("renvoie [] si rien n'est stocké", () => {
    expect(parseStoredWishlist(null)).toEqual([])
    expect(parseStoredWishlist('')).toEqual([])
  })

  it('renvoie [] sur un JSON corrompu', () => {
    expect(parseStoredWishlist('{pas du json')).toEqual([])
  })

  it("renvoie [] si ce n'est pas un tableau", () => {
    expect(parseStoredWishlist('{"pokemon":{}}')).toEqual([])
  })

  it('relit une liste valide', () => {
    const list = [item(pikachu, DAY_1), item(eevee, DAY_2)]
    expect(parseStoredWishlist(JSON.stringify(list))).toEqual(list)
  })

  it('ignore les entrées invalides et les doublons', () => {
    const raw = JSON.stringify([
      item(pikachu, DAY_1),
      { pokemon: { id: 'x', name: 'Bad' }, addedAt: DAY_1.toISOString() },
      { pokemon: eevee, addedAt: 'pas une date' },
      null,
      42,
      item(pikachu, DAY_2),
    ])
    expect(parseStoredWishlist(raw)).toEqual([item(pikachu, DAY_1)])
  })

  it("convertit l'ancien format (Pokemon[]) en entrées datées", () => {
    const raw = JSON.stringify([pikachu, eevee])
    expect(parseStoredWishlist(raw, DAY_2)).toEqual([
      item(pikachu, DAY_2),
      item(eevee, DAY_2),
    ])
  })

  it('ne garde que les 6 premières entrées', () => {
    const raw = JSON.stringify(listOf(8))
    expect(parseStoredWishlist(raw).map((i) => i.pokemon.id)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
  })

  it('ne garde que les champs connus', () => {
    const raw = JSON.stringify([
      { pokemon: { ...pikachu, extra: true }, addedAt: DAY_1, foo: 'bar' },
    ])
    expect(parseStoredWishlist(raw)).toEqual([item(pikachu, DAY_1)])
  })
})
