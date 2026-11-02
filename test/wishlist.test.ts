import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../shared/types/pokemon'
import type { WishlistItem } from '../shared/types/wishlist'
import {
  addToWishlist,
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

describe('addToWishlist', () => {
  it('crée une entrée datée', () => {
    expect(addToWishlist([], pikachu, DAY_1)).toEqual([
      { pokemon: pikachu, addedAt: '2026-11-01T10:00:00.000Z' },
    ])
  })

  it('ne crée pas de doublon', () => {
    const list = [item(pikachu, DAY_1)]
    expect(addToWishlist(list, { ...pikachu }, DAY_2)).toEqual(list)
  })

  it("ne modifie pas le tableau d'origine", () => {
    const list = [item(pikachu, DAY_1)]
    const result = addToWishlist(list, eevee, DAY_2)
    expect(list).toHaveLength(1)
    expect(result).toHaveLength(2)
    expect(result).not.toBe(list)
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

  it('ne garde que les champs connus', () => {
    const raw = JSON.stringify([
      { pokemon: { ...pikachu, extra: true }, addedAt: DAY_1, foo: 'bar' },
    ])
    expect(parseStoredWishlist(raw)).toEqual([item(pikachu, DAY_1)])
  })
})
