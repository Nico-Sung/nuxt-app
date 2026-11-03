import { describe, expect, it } from 'vitest'
import data from '../shared/data/pokemon-names.json'
import { abilityName, pokemonName, pokemonNames } from '../shared/utils/names'
import { searchPokemon } from '../shared/utils/search'
import type { Pokemon } from '../shared/types/pokemon'

describe('pokemonName', () => {
  it.each([
    [1, 'Bulbizarre', 'Bulbasaur'],
    [4, 'Salamèche', 'Charmander'],
    [25, 'Pikachu', 'Pikachu'],
    [122, 'M. Mime', 'Mr. Mime'],
    [133, 'Évoli', 'Eevee'],
    [1025, 'Pêchaminus', 'Pecharunt'],
  ])('n° %i : %s (fr) / %s (en)', (id, fr, en) => {
    expect(pokemonName(id, 'fr', '?')).toBe(fr)
    expect(pokemonName(id, 'en', '?')).toBe(en)
  })

  it('langue inconnue : anglais', () => {
    expect(pokemonName(1, 'de', '?')).toBe('Bulbasaur')
  })

  it('forme sans nom traduit (id > 10000) : nom fourni', () => {
    expect(pokemonName(10034, 'fr', 'Charizard Mega X')).toBe(
      'Charizard Mega X',
    )
  })

  it('pokemonNames : tous les noms connus', () => {
    expect(pokemonNames(1).sort()).toEqual(['Bulbasaur', 'Bulbizarre'])
    expect(pokemonNames(99999)).toEqual([])
  })
})

describe('abilityName', () => {
  it('traduit les talents, avec repli', () => {
    expect(abilityName('static', 'fr', '?')).toBe('Statik')
    expect(abilityName('static', 'en', '?')).toBe('Static')
    expect(abilityName('lightning-rod', 'fr', '?')).toBe('Paratonnerre')
    expect(abilityName('talent-inconnu', 'fr', 'Talent Inconnu')).toBe(
      'Talent Inconnu',
    )
  })
})

describe('fichier généré (shared/data/pokemon-names.json)', () => {
  const species = Object.entries(data.species) as [
    string,
    { en?: string; fr?: string },
  ][]

  it('les 1 025 espèces, numérotées de 1 à 1025', () => {
    expect(species.map(([id]) => Number(id))).toEqual(
      Array.from({ length: 1025 }, (_, i) => i + 1),
    )
  })

  it('chaque espèce a un nom anglais et un nom français', () => {
    const incomplete = species.filter(([, names]) => !names.en || !names.fr)
    expect(incomplete).toEqual([])
  })

  it('des centaines de talents', () => {
    expect(Object.keys(data.abilities).length).toBeGreaterThan(300)
  })
})

describe('recherche dans toutes les langues', () => {
  const LIST: Pokemon[] = [
    { id: 1, name: 'Bulbasaur', sprite: '' },
    { id: 133, name: 'Eevee', sprite: '' },
    { id: 143, name: 'Snorlax', sprite: '' },
  ]
  const allNames = (p: Pokemon) => [p.name, ...pokemonNames(p.id)]
  const ids = (list: Pokemon[]) => list.map((p) => p.id)

  it('nom français ou anglais, avec ou sans accents', () => {
    expect(ids(searchPokemon(LIST, 'bulbi', 20, allNames))).toEqual([1])
    expect(ids(searchPokemon(LIST, 'bulba', 20, allNames))).toEqual([1])
    expect(ids(searchPokemon(LIST, 'évoli', 20, allNames))).toEqual([133])
    expect(ids(searchPokemon(LIST, 'evoli', 20, allNames))).toEqual([133])
    expect(ids(searchPokemon(LIST, 'ronfl', 20, allNames))).toEqual([143])
  })

  it('sans noms traduits : anglais seulement (comportement par défaut)', () => {
    expect(ids(searchPokemon(LIST, 'bulbi'))).toEqual([])
    expect(ids(searchPokemon(LIST, 'bulba'))).toEqual([1])
  })
})
