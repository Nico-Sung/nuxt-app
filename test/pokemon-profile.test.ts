import { describe, expect, it, vi } from 'vitest'
import type {
  PokeApiPokemonProfileResponse,
  PokeApiSpeciesResponse,
} from '../shared/types/pokemon'
import {
  cleanFlavorText,
  isPokemonSlug,
  pickLocalized,
  pokemonSlug,
  toPokemonProfile,
} from '../shared/utils/pokeapi'
import {
  formatHeight,
  formatNumber,
  formatWeight,
} from '../shared/utils/format'
import {
  fetchPokemonProfile,
  PokeApiUnavailableError,
  PokemonNotFoundError,
} from '../server/lib/pokeapi'

const stat = (name: string, base_stat: number) => ({
  base_stat,
  stat: { name },
})

/** Extrait de GET /pokemon/pikachu. */
const PIKACHU: PokeApiPokemonProfileResponse = {
  id: 25,
  name: 'pikachu',
  height: 4,
  weight: 60,
  species: {
    name: 'pikachu',
    url: 'https://pokeapi.co/api/v2/pokemon-species/25/',
  },
  abilities: [
    { ability: { name: 'lightning-rod' }, is_hidden: true, slot: 3 },
    { ability: { name: 'static' }, is_hidden: false, slot: 1 },
  ],
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

const lang = (name: string) => ({ language: { name } })

/** Extrait de GET /pokemon-species/25 (textes tels que PokéAPI les renvoie). */
const PIKACHU_SPECIES: PokeApiSpeciesResponse = {
  genera: [
    { genus: 'Mouse Pokémon', ...lang('en') },
    { genus: 'Pokémon Souris', ...lang('fr') },
  ],
  flavor_text_entries: [
    { flavor_text: 'Old english text.', ...lang('en') },
    { flavor_text: 'Ancien texte.', ...lang('fr') },
    {
      flavor_text:
        'Il lui arrive de\nremettre sur pied\fun Pikachu\nen dé­\nchargeant.',
      ...lang('fr'),
    },
    { flavor_text: 'Latest english text.', ...lang('en') },
  ],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** fetch simulé : une réponse par URL (le garde-fou de test/setup.ts bloque le reste). */
function mockRoutes(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn((url: string) => {
    const route = routes[url]
    if (!route)
      return Promise.resolve(new Response('Not Found', { status: 404 }))
    return Promise.resolve(route())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const BASE = 'https://pokeapi.co/api/v2'
const POKEMON_URL = `${BASE}/pokemon/pikachu`
const SPECIES_URL = `${BASE}/pokemon-species/25`

describe('toPokemonProfile', () => {
  it('construit la fiche complète', () => {
    expect(toPokemonProfile(PIKACHU, PIKACHU_SPECIES)).toEqual({
      id: 25,
      slug: 'pikachu',
      name: 'Pikachu',
      sprite:
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
      genus: 'Pokémon Souris',
      description:
        'Il lui arrive de remettre sur pied un Pikachu en déchargeant.',
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
      abilities: [
        { name: 'Static', hidden: false },
        { name: 'Lightning Rod', hidden: true },
      ],
    })
  })

  it('sans texte français : repli sur l’anglais le plus récent', () => {
    const species: PokeApiSpeciesResponse = {
      genera: [{ genus: 'Mouse Pokémon', ...lang('en') }],
      flavor_text_entries: PIKACHU_SPECIES.flavor_text_entries.filter(
        (e) => e.language.name === 'en',
      ),
    }
    const profile = toPokemonProfile(PIKACHU, species)
    expect(profile.genus).toBe('Mouse Pokémon')
    expect(profile.description).toBe('Latest english text.')
  })

  it('sans espèce : ni catégorie ni description', () => {
    const profile = toPokemonProfile(PIKACHU, null)
    expect(profile.genus).toBeNull()
    expect(profile.description).toBeNull()
    expect(profile.name).toBe('Pikachu')
  })

  it('aucune langue connue : null', () => {
    const species: PokeApiSpeciesResponse = {
      genera: [{ genus: 'ネズミポケモン', ...lang('ja') }],
      flavor_text_entries: [],
    }
    const profile = toPokemonProfile(PIKACHU, species)
    expect(profile.genus).toBeNull()
    expect(profile.description).toBeNull()
  })
})

describe('outils de la fiche', () => {
  it('pickLocalized : première langue disponible, entrée la plus récente', () => {
    const entries = [
      { v: 1, ...lang('en') },
      { v: 2, ...lang('fr') },
      { v: 3, ...lang('fr') },
    ]
    expect(pickLocalized(entries)?.v).toBe(3)
    expect(pickLocalized(entries, ['de', 'en'])?.v).toBe(1)
    expect(pickLocalized(entries, ['de'])).toBeUndefined()
  })

  it('cleanFlavorText : retire retours à la ligne, sauts de page et césures', () => {
    expect(cleanFlavorText('Un\ntexte\fsur  plusieurs\nli­\ngnes. ')).toBe(
      'Un texte sur plusieurs lignes.',
    )
  })

  it.each([
    ['pikachu', true],
    ['mr-mime', true],
    ['porygon-z', true],
    ['25', true],
    ['Pikachu', false],
    ['mr mime', false],
    ['-pikachu', false],
    ['pika--chu', false],
    ['', false],
    ['../etc', false],
    ['a'.repeat(51), false],
  ])('isPokemonSlug(%j) = %s', (value, expected) => {
    expect(isPokemonSlug(value)).toBe(expected)
  })

  it('pokemonSlug : nom affiché -> nom d’URL', () => {
    expect(pokemonSlug('Pikachu')).toBe('pikachu')
    expect(pokemonSlug('Mr Mime')).toBe('mr-mime')
    expect(pokemonSlug('Nidoran F')).toBe('nidoran-f')
  })

  it('formate taille, poids et numéro', () => {
    expect(formatHeight(4)).toBe('0,4 m')
    expect(formatHeight(17)).toBe('1,7 m')
    expect(formatWeight(60)).toBe('6 kg')
    expect(formatWeight(9055)).toBe('905,5 kg')
    expect(formatNumber(25)).toBe('#025')
    expect(formatNumber(1025)).toBe('#1025')
  })
})

describe('fetchPokemonProfile', () => {
  it('200 : appelle /pokemon puis /pokemon-species et renvoie la fiche', async () => {
    const fetchMock = mockRoutes({
      [POKEMON_URL]: () => json(PIKACHU),
      [SPECIES_URL]: () => json(PIKACHU_SPECIES),
    })

    const profile = await fetchPokemonProfile('pikachu')

    expect(profile.name).toBe('Pikachu')
    expect(profile.genus).toBe('Pokémon Souris')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      POKEMON_URL,
      SPECIES_URL,
    ])
  })

  it('utilise l’URL de base fournie (faux PokéAPI des tests E2E)', async () => {
    const base = 'http://localhost:3202/api/v2'
    const fetchMock = mockRoutes({
      [`${base}/pokemon/pikachu`]: () => json(PIKACHU),
      [`${base}/pokemon-species/25`]: () => json(PIKACHU_SPECIES),
    })

    await expect(fetchPokemonProfile('pikachu', base)).resolves.toMatchObject({
      description:
        'Il lui arrive de remettre sur pied un Pikachu en déchargeant.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('404 : lève PokemonNotFoundError, sans appeler l’espèce', async () => {
    const fetchMock = mockRoutes({})

    const error = await fetchPokemonProfile('inconnu').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PokemonNotFoundError)
    expect((error as Error).message).toBe('Pokémon inconnu introuvable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('500 sur /pokemon : lève PokeApiUnavailableError', async () => {
    mockRoutes({
      [POKEMON_URL]: () => new Response('boom', { status: 500 }),
    })
    await expect(fetchPokemonProfile('pikachu')).rejects.toThrow(
      PokeApiUnavailableError,
    )
  })

  it('espèce en panne : la fiche est renvoyée sans description', async () => {
    mockRoutes({
      [POKEMON_URL]: () => json(PIKACHU),
      [SPECIES_URL]: () => new Response('boom', { status: 503 }),
    })

    const profile = await fetchPokemonProfile('pikachu')
    expect(profile.name).toBe('Pikachu')
    expect(profile.stats.speed).toBe(90)
    expect(profile.description).toBeNull()
    expect(profile.genus).toBeNull()
  })
})
