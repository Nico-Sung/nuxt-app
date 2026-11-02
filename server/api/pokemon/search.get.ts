import type { Pokemon } from '#shared/types/pokemon'
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

  return searchPokemon(index, query)
})
