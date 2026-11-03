import { describe, expect, it, vi } from 'vitest'
import { fetchPokemonRoutes, pokemonRoutes } from '../build/pokemonRoutes'

const item = (id: number, name: string) => ({
  name,
  url: `https://pokeapi.co/api/v2/pokemon/${id}/`,
})

/** Extrait de GET /pokemon?limit=100000 : formes par défaut puis alternatives. */
const LIST = {
  count: 6,
  results: [
    item(25, 'pikachu'),
    item(1, 'bulbasaur'),
    item(386, 'deoxys-normal'),
    item(1025, 'pecharunt'),
    item(10001, 'deoxys-attack'),
    item(10034, 'charizard-mega-x'),
  ],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('pokemonRoutes', () => {
  it('formes par défaut seulement (id < 10000), triées par numéro', () => {
    expect(pokemonRoutes(LIST)).toEqual([
      '/pokemon/bulbasaur',
      '/pokemon/pikachu',
      '/pokemon/deoxys-normal',
      '/pokemon/pecharunt',
    ])
  })

  it('limite (essai local rapide)', () => {
    expect(pokemonRoutes(LIST, 2)).toEqual([
      '/pokemon/bulbasaur',
      '/pokemon/pikachu',
    ])
  })

  it('ignore un nom qui ne ferait pas une URL valide', () => {
    expect(
      pokemonRoutes({
        count: 2,
        results: [item(1, 'Bad Name'), item(2, 'ivysaur')],
      }),
    ).toEqual(['/pokemon/ivysaur'])
  })
})

describe('fetchPokemonRoutes', () => {
  it('appelle la liste PokéAPI et renvoie les routes', async () => {
    const fetchMock = vi.fn(async () => json(LIST))
    await expect(
      fetchPokemonRoutes('https://pokeapi.co/api/v2', { fetch: fetchMock }),
    ).resolves.toHaveLength(4)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pokeapi.co/api/v2/pokemon?limit=100000',
    )
  })

  it('réessaie après une erreur temporaire', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(json(LIST))
    await expect(
      fetchPokemonRoutes('https://x', { fetch: fetchMock, retryDelayMs: 0 }),
    ).resolves.toHaveLength(4)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('échoue après 3 essais : le build s’arrête au lieu de déployer sans fiches', async () => {
    const fetchMock = vi.fn(async () => new Response('down', { status: 500 }))
    await expect(
      fetchPokemonRoutes('https://x', { fetch: fetchMock, retryDelayMs: 0 }),
    ).rejects.toThrow('Liste PokéAPI indisponible')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('liste vide : erreur', async () => {
    const fetchMock = vi.fn(async () => json({ count: 0, results: [] }))
    await expect(
      fetchPokemonRoutes('https://x', { fetch: fetchMock, retryDelayMs: 0 }),
    ).rejects.toThrow('aucun Pokémon')
  })
})
