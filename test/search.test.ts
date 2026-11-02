import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../shared/types/pokemon'
import { normalizeText, searchPokemon } from '../shared/utils/search'

const make = (id: number, name: string): Pokemon => ({
  id,
  name,
  sprite: `${id}.png`,
})

const LIST: Pokemon[] = [
  make(2, 'Ivysaur'),
  make(25, 'Pikachu'),
  make(26, 'Raichu'),
  make(122, 'Mr Mime'),
  make(172, 'Pichu'),
  make(10080, 'Pikachu Rock Star'),
]

const names = (list: Pokemon[]) => list.map((p) => p.name)

describe('normalizeText', () => {
  it('ignore majuscules, accents et tirets', () => {
    expect(normalizeText('  Flabébé ')).toBe('flabebe')
    expect(normalizeText('Mr-Mime')).toBe('mr mime')
  })
})

describe('searchPokemon', () => {
  it('renvoie [] pour une recherche vide ou trop courte', () => {
    expect(searchPokemon(LIST, '')).toEqual([])
    expect(searchPokemon(LIST, '   ')).toEqual([])
    expect(searchPokemon(LIST, 'p')).toEqual([])
  })

  it('cherche un numéro exact', () => {
    expect(names(searchPokemon(LIST, '25'))).toEqual(['Pikachu'])
    expect(names(searchPokemon(LIST, '2'))).toEqual(['Ivysaur'])
  })

  it('accepte le format #025', () => {
    expect(names(searchPokemon(LIST, '#25'))).toEqual(['Pikachu'])
    expect(names(searchPokemon(LIST, '#025'))).toEqual(['Pikachu'])
  })

  it('met en premier les noms qui commencent par la recherche', () => {
    expect(names(searchPokemon(LIST, 'pi'))).toEqual([
      'Pikachu',
      'Pichu',
      'Pikachu Rock Star',
    ])
    expect(names(searchPokemon(LIST, 'chu'))).toEqual([
      'Pikachu',
      'Raichu',
      'Pichu',
      'Pikachu Rock Star',
    ])
    expect(names(searchPokemon(LIST, 'rai'))[0]).toBe('Raichu')
  })

  it('ignore la casse et les tirets', () => {
    expect(names(searchPokemon(LIST, 'PIKA'))).toEqual([
      'Pikachu',
      'Pikachu Rock Star',
    ])
    expect(names(searchPokemon(LIST, 'mr-mime'))).toEqual(['Mr Mime'])
  })

  it('respecte la limite', () => {
    expect(searchPokemon(LIST, 'chu', 2)).toHaveLength(2)
  })

  it('renvoie [] si rien ne correspond', () => {
    expect(searchPokemon(LIST, 'zzzz')).toEqual([])
  })
})
