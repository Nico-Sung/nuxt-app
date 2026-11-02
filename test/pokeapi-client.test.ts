import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PokeApiPokemonResponse } from '../shared/types/pokemon'
import {
  fetchPokemonDetails,
  fetchPokemonIndex,
  PokeApiUnavailableError,
  PokemonNotFoundError,
  toHttpError,
} from '../server/lib/pokeapi'

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Remplace fetch par un mock qui renvoie `response` (ou exécute `impl`). */
function mockFetch(impl: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('garde-fou réseau', () => {
  it('fait échouer tout fetch non simulé', async () => {
    await expect(fetchPokemonDetails(25)).rejects.toThrow(
      PokeApiUnavailableError,
    )
    expect(() => fetch('https://pokeapi.co')).toThrow(
      'Appel réseau non simulé dans un test',
    )
  })
})

describe('fetchPokemonDetails', () => {
  it('200 : renvoie les détails du Pokémon', async () => {
    const fetchMock = mockFetch(() => json(PIKACHU))

    await expect(fetchPokemonDetails(25)).resolves.toEqual({
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pokeapi.co/api/v2/pokemon/25',
    )
  })

  it('404 : lève PokemonNotFoundError', async () => {
    mockFetch(() => new Response('Not Found', { status: 404 }))

    const error = await fetchPokemonDetails(99999).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PokemonNotFoundError)
    expect((error as Error).message).toBe('Pokémon 99999 introuvable')
  })

  it('500 : lève PokeApiUnavailableError', async () => {
    mockFetch(() => new Response('Server Error', { status: 500 }))
    await expect(fetchPokemonDetails(25)).rejects.toThrow(
      PokeApiUnavailableError,
    )
  })

  it('réseau coupé : lève PokeApiUnavailableError', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(fetchPokemonDetails(25)).rejects.toThrow(
      PokeApiUnavailableError,
    )
  })

  it('JSON invalide : lève PokeApiUnavailableError', async () => {
    mockFetch(() => new Response('<html>oops</html>', { status: 200 }))
    await expect(fetchPokemonDetails(25)).rejects.toThrow(
      PokeApiUnavailableError,
    )
  })
})

describe('fetchPokemonIndex', () => {
  beforeEach(() => {
    mockFetch(() =>
      json({
        count: 3,
        results: [
          { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon/25/' },
          { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon/1/' },
          { name: 'mr-mime', url: 'https://pokeapi.co/api/v2/pokemon/122/' },
        ],
      }),
    )
  })

  it('200 : renvoie les Pokémon triés par id, noms formatés', async () => {
    const list = await fetchPokemonIndex()
    expect(list.map((p) => [p.id, p.name])).toEqual([
      [1, 'Bulbasaur'],
      [25, 'Pikachu'],
      [122, 'Mr Mime'],
    ])
    expect(fetch).toHaveBeenCalledWith(
      'https://pokeapi.co/api/v2/pokemon?limit=100000',
    )
  })

  it('503 : lève PokeApiUnavailableError', async () => {
    mockFetch(() => new Response('Unavailable', { status: 503 }))
    await expect(fetchPokemonIndex()).rejects.toThrow(PokeApiUnavailableError)
  })
})

describe('toHttpError', () => {
  it('traduit les erreurs en codes HTTP', () => {
    expect(toHttpError(new PokemonNotFoundError(1))).toEqual({
      statusCode: 404,
      statusMessage: 'Pokémon introuvable',
    })
    expect(toHttpError(new PokeApiUnavailableError('down'))).toEqual({
      statusCode: 502,
      statusMessage: 'PokéAPI indisponible',
    })
    expect(toHttpError(new Error('???'))).toEqual({
      statusCode: 502,
      statusMessage: 'PokéAPI indisponible',
    })
  })
})
