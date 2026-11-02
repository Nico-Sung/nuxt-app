import type { Pokemon, PokeApiListItem } from '../types/pokemon'

/** Extrait l'id d'une URL PokéAPI, ex. ".../pokemon/25/" -> 25 */
export function idFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/)
  if (!match) throw new Error(`URL PokéAPI invalide : ${url}`)
  return Number(match[1])
}

/** "mr-mime" -> "Mr Mime", "bulbasaur" -> "Bulbasaur" */
export function formatName(name: string): string {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function spriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

export function toPokemon(item: PokeApiListItem): Pokemon {
  const id = idFromUrl(item.url)
  return { id, name: formatName(item.name), sprite: spriteUrl(id) }
}
