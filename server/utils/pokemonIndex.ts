import { fetchPokemonIndex } from '../lib/pokeapi'

/** Liste complète des Pokémon PokéAPI, mise en cache 24 h. */
export const getPokemonIndex = defineCachedFunction(fetchPokemonIndex, {
  name: 'pokemon-index',
  maxAge: 60 * 60 * 24,
})
