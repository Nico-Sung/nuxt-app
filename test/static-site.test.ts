import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { searchPokemonLocally } from '../shared/utils/localSearch'
import { speciesSlugs } from '../shared/utils/names'

describe('recherche locale (site statique, sans réseau)', () => {
  const ids = (query: string) => searchPokemonLocally(query).map((p) => p.id)

  it('cherche dans les noms anglais et français, avec ou sans accent', () => {
    expect(ids('bulbi')).toEqual([1])
    expect(ids('bulba')).toEqual([1])
    expect(ids('evoli')).toEqual([133])
    expect(ids('#025')).toEqual([25])
  })

  it('renvoie la même forme que l’index du serveur (nom formaté depuis l’URL)', () => {
    expect(searchPokemonLocally('mr mime')[0]).toEqual({
      id: 122,
      name: 'Mr Mime',
      sprite:
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/122.png',
    })
    // forme par défaut : l'URL de la fiche est /pokemon/deoxys-normal
    expect(searchPokemonLocally('deoxys')[0]?.name).toBe('Deoxys Normal')
  })

  it('limite à 20 résultats, requête trop courte : rien', () => {
    expect(searchPokemonLocally('a')).toEqual([])
    expect(searchPokemonLocally('an').length).toBeLessThanOrEqual(20)
  })

  it('1 025 espèces avec leur nom d’URL', () => {
    const slugs = speciesSlugs()
    expect(slugs).toHaveLength(1025)
    expect(slugs[0]).toEqual({ id: 1, slug: 'bulbasaur' })
    expect(slugs.find((s) => s.id === 386)?.slug).toBe('deoxys-normal')
  })
})

describe('CloudFront Function : réécriture des URL vers S3', () => {
  const code = readFileSync('infra/functions/url-rewrite.js', 'utf8')
  const handler = new Function(`${code}; return handler`)() as (event: {
    request: { uri: string }
  }) => Promise<{ uri: string }>

  it.each([
    ['/', '/index.html'],
    ['/pokemon/pikachu', '/pokemon/pikachu/index.html'],
    ['/pokemon/pikachu/', '/pokemon/pikachu/index.html'],
    ['/pokemon/deoxys-normal', '/pokemon/deoxys-normal/index.html'],
    ['/version.json', '/version.json'],
    ['/_nuxt/entry.Ab12.js', '/_nuxt/entry.Ab12.js'],
    ['/pokemon/pikachu/_payload.json', '/pokemon/pikachu/_payload.json'],
    ['/favicon.ico', '/favicon.ico'],
  ])('%s -> %s', async (uri, expected) => {
    expect((await handler({ request: { uri } })).uri).toBe(expected)
  })
})
