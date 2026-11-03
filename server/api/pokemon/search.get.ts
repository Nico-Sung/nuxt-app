import type { Pokemon } from '#shared/types/pokemon'
import { pokemonNames } from '#shared/utils/names'
import { searchPokemon } from '#shared/utils/search'

export default defineEventHandler(async (event): Promise<Pokemon[]> => {
  const { q } = getQuery(event)
  const query = typeof q === 'string' ? q : ''

  let index: Pokemon[]
  try {
    index = await getPokemonIndex()
  } catch (cause) {
    throw createError({
      statusCode: 502,
      statusMessage: 'PokéAPI indisponible',
      cause,
    })
  }

  // Cherche dans tous les noms : anglais (PokéAPI) et traduits (Bulbizarre…).
  return searchPokemon(index, query, 20, (p) => [p.name, ...pokemonNames(p.id)])
})
