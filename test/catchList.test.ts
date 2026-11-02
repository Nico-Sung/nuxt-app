import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../shared/types/pokemon'
import { addPokemon, parseStoredList, removePokemon } from '../app/utils/catchList'

const pikachu: Pokemon = { id: 25, name: 'Pikachu', sprite: '25.png' }
const eevee: Pokemon = { id: 133, name: 'Eevee', sprite: '133.png' }

describe('addPokemon', () => {
  it('ajoute un Pokémon', () => {
    expect(addPokemon([pikachu], eevee)).toEqual([pikachu, eevee])
  })

  it('ne crée pas de doublon', () => {
    expect(addPokemon([pikachu], { ...pikachu })).toEqual([pikachu])
  })

  it('ne modifie pas le tableau d\'origine', () => {
    const list = [pikachu]
    const result = addPokemon(list, eevee)
    expect(list).toEqual([pikachu])
    expect(result).not.toBe(list)
  })
})

describe('removePokemon', () => {
  it('retire le bon Pokémon', () => {
    expect(removePokemon([pikachu, eevee], 25)).toEqual([eevee])
  })

  it('ne change rien si l\'id est absent', () => {
    expect(removePokemon([pikachu], 999)).toEqual([pikachu])
  })
})

describe('parseStoredList', () => {
  it('renvoie [] si rien n\'est stocké', () => {
    expect(parseStoredList(null)).toEqual([])
    expect(parseStoredList('')).toEqual([])
  })

  it('renvoie [] sur un JSON corrompu', () => {
    expect(parseStoredList('{pas du json')).toEqual([])
  })

  it('renvoie [] si ce n\'est pas un tableau', () => {
    expect(parseStoredList('{"id":25}')).toEqual([])
  })

  it('ignore les entrées invalides et les doublons', () => {
    const raw = JSON.stringify([pikachu, { id: 'x', name: 'Bad' }, null, 42, eevee, pikachu])
    expect(parseStoredList(raw)).toEqual([pikachu, eevee])
  })
})
