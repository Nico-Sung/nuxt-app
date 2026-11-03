import type { Pokemon } from '../types/pokemon'
import { pokemonNames, speciesSlugs } from './names'
import { formatName, spriteUrl } from './pokeapi'
import { searchPokemon } from './search'

/**
 * Index de recherche sans réseau, construit depuis shared/data/pokemon-names.json :
 * même forme que l'index PokéAPI du serveur (nom anglais formaté depuis l'URL).
 * Utilisé par le site statique (pas de route /api/pokemon/search).
 */
let index: Pokemon[] | undefined

function localIndex(): Pokemon[] {
  index ??= speciesSlugs().map(({ id, slug }) => ({
    id,
    name: formatName(slug),
    sprite: spriteUrl(id),
  }))
  return index
}

/** Recherche dans les noms anglais et français, comme la route serveur. */
export function searchPokemonLocally(query: string, limit = 20): Pokemon[] {
  return searchPokemon(localIndex(), query, limit, (p) => [
    p.name,
    ...pokemonNames(p.id),
  ])
}
