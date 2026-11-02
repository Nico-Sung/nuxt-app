import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../shared/types/pokemon'
import type { WishlistItem } from '../shared/types/wishlist'
import {
  isWishlistFull,
  MAX_WISHLIST_SIZE,
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

const listOf = (count: number): WishlistItem[] =>
  Array.from({ length: count }, (_, i) =>
    item({ id: i + 1, name: `Pokemon ${i + 1}`, sprite: '' }, DAY_1),
  )

describe('isWishlistFull', () => {
  it('limite à 6 Pokémon', () => {
    expect(MAX_WISHLIST_SIZE).toBe(6)
    expect(isWishlistFull(listOf(5))).toBe(false)
    expect(isWishlistFull(listOf(6))).toBe(true)
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
