import { describe, expect, it } from 'vitest'
import type { PokeApiPokemonResponse } from '../shared/types/pokemon'
import { toPokemonDetails } from '../shared/utils/pokeapi'
import {
  MAX_BASE_STAT,
  statLevel,
  statPercent,
  totalStats,
} from '../shared/utils/stats'
import { TYPE_COLORS, typeColor } from '../shared/utils/types'
import en from '../i18n/locales/en.json'
import fr from '../i18n/locales/fr.json'
import { POKEMON_TYPE_NAMES, STAT_NAMES } from '../shared/types/pokemon'

const stat = (name: string, base_stat: number) => ({
  base_stat,
  stat: { name },
})

/** Extrait réel de GET /pokemon/25 (Pikachu). */
const PIKACHU: PokeApiPokemonResponse = {
  id: 25,
  height: 4,
  weight: 60,
  types: [{ slot: 1, type: { name: 'electric' } }],
  stats: [
    stat('hp', 35),
    stat('attack', 55),
    stat('defense', 40),
    stat('special-attack', 50),
    stat('special-defense', 50),
    stat('speed', 90),
  ],
}

describe('toPokemonDetails', () => {
  it('transforme la réponse PokéAPI', () => {
    expect(toPokemonDetails(PIKACHU)).toEqual({
      id: 25,
      types: ['electric'],
      stats: {
        hp: 35,
        attack: 55,
        defense: 40,
        'special-attack': 50,
        'special-defense': 50,
        speed: 90,
      },
      height: 4,
      weight: 60,
    })
  })

  it('trie les types par slot et ignore les types inconnus', () => {
    const details = toPokemonDetails({
      ...PIKACHU,
      types: [
        { slot: 2, type: { name: 'flying' } },
        { slot: 3, type: { name: 'shadow' } },
        { slot: 1, type: { name: 'fire' } },
      ],
    })
    expect(details.types).toEqual(['fire', 'flying'])
  })

  it('retombe sur « normal » si aucun type connu', () => {
    const details = toPokemonDetails({
      ...PIKACHU,
      types: [{ slot: 1, type: { name: 'shadow' } }],
    })
    expect(details.types).toEqual(['normal'])
  })

  it('met 0 pour une stat absente', () => {
    const details = toPokemonDetails({ ...PIKACHU, stats: [stat('hp', 35)] })
    expect(details.stats.hp).toBe(35)
    expect(details.stats.speed).toBe(0)
  })
})

describe('statPercent', () => {
  it('ramène la stat entre 0 et 100 %', () => {
    expect(statPercent(0)).toBe(0)
    expect(statPercent(-5)).toBe(0)
    expect(statPercent(MAX_BASE_STAT)).toBe(100)
    expect(statPercent(300)).toBe(100)
    expect(statPercent(90)).toBe(35)
  })
})

describe('statLevel', () => {
  it('classe les stats en faible / moyen / élevé', () => {
    expect(statLevel(59)).toBe('low')
    expect(statLevel(60)).toBe('mid')
    expect(statLevel(99)).toBe('mid')
    expect(statLevel(100)).toBe('high')
  })
})

describe('totalStats', () => {
  it('additionne les 6 stats', () => {
    expect(totalStats(toPokemonDetails(PIKACHU).stats)).toBe(320)
  })
})

describe('libellés (i18n/locales)', () => {
  it('chaque stat a un libellé en anglais et en français', () => {
    for (const name of STAT_NAMES) {
      expect(en.stats[name], `en: stats.${name}`).toBeTruthy()
      expect(fr.stats[name], `fr: stats.${name}`).toBeTruthy()
    }
    expect(STAT_NAMES.map((name) => fr.stats[name])).toEqual([
      'PV',
      'Attaque',
      'Défense',
      'Att. Spé.',
      'Déf. Spé.',
      'Vitesse',
    ])
    expect(en.stats.hp).toBe('HP')
  })

  it('chaque type a un libellé en anglais et en français', () => {
    for (const name of POKEMON_TYPE_NAMES) {
      expect(en.types[name], `en: types.${name}`).toBeTruthy()
      expect(fr.types[name], `fr: types.${name}`).toBeTruthy()
    }
    expect(fr.types.electric).toBe('Électrik')
    expect(en.types.electric).toBe('Electric')
  })

  it('donne la couleur des types, avec repli sur normal', () => {
    expect(typeColor('electric')).toBe(TYPE_COLORS.electric)
    expect(typeColor('inconnu')).toBe(TYPE_COLORS.normal)
    expect(Object.keys(TYPE_COLORS)).toHaveLength(18)
  })
})
