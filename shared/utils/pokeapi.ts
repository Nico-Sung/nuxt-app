import type { Pokemon, PokeApiListItem } from '../types/pokemon'

const SPRITES_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

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

/** Illustration officielle (grande taille). */
export function spriteUrl(id: number): string {
  return `${SPRITES_BASE}/other/official-artwork/${id}.png`
}

/** Petit sprite de jeu, utilisé en secours si l'illustration manque. */
export function smallSpriteUrl(id: number): string {
  return `${SPRITES_BASE}/${id}.png`
}

export function toPokemon(item: PokeApiListItem): Pokemon {
  const id = idFromUrl(item.url)
  return { id, name: formatName(item.name), sprite: spriteUrl(id) }
}
