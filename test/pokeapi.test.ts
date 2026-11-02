import { describe, expect, it } from 'vitest'
import {
  formatName,
  idFromUrl,
  smallSpriteUrl,
  spriteUrl,
  toPokemon,
} from '../shared/utils/pokeapi'

describe('idFromUrl', () => {
  it("extrait l'id avec ou sans slash final", () => {
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon/25/')).toBe(25)
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon/25')).toBe(25)
  })

  it('lève une erreur sur une URL invalide', () => {
    expect(() => idFromUrl('https://pokeapi.co/api/v2/pokemon/')).toThrow()
  })
})

describe('formatName', () => {
  it('met une majuscule et remplace les tirets', () => {
    expect(formatName('bulbasaur')).toBe('Bulbasaur')
    expect(formatName('mr-mime')).toBe('Mr Mime')
    expect(formatName('ho-oh')).toBe('Ho Oh')
  })
})

describe('URLs des images', () => {
  it("pointe vers l'illustration officielle et le petit sprite", () => {
    expect(spriteUrl(25)).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
    )
    expect(smallSpriteUrl(25)).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
    )
  })
})

describe('toPokemon', () => {
  it('transforme une entrée PokéAPI en Pokemon', () => {
    expect(
      toPokemon({
        name: 'pikachu',
        url: 'https://pokeapi.co/api/v2/pokemon/25/',
      }),
    ).toEqual({
      id: 25,
      name: 'Pikachu',
      sprite: spriteUrl(25),
    })
  })
})
