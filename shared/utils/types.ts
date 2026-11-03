import type { PokemonTypeName } from '../types/pokemon'
import { POKEMON_TYPE_NAMES } from '../types/pokemon'

/** Couleur de chaque type (les libellés sont dans i18n/locales, clé `types.<nom>`). */
export const TYPE_COLORS: Readonly<Record<PokemonTypeName, string>> = {
  normal: '#9099a1',
  fire: '#e8743b',
  water: '#4d90d5',
  electric: '#d4a90c',
  grass: '#5fa94a',
  ice: '#5fb8ae',
  fighting: '#ce4069',
  poison: '#ab6ac8',
  ground: '#d97746',
  flying: '#8fa8dd',
  psychic: '#e5627a',
  bug: '#8fb02a',
  rock: '#b5a56b',
  ghost: '#5269ac',
  dragon: '#0b6dc3',
  dark: '#5a5366',
  steel: '#5a8ea1',
  fairy: '#d77fd0',
}

export function isPokemonTypeName(value: string): value is PokemonTypeName {
  return (POKEMON_TYPE_NAMES as readonly string[]).includes(value)
}

/** Couleur d'un type ; un type inconnu retombe sur « normal ». */
export function typeColor(name: string): string {
  return isPokemonTypeName(name) ? TYPE_COLORS[name] : TYPE_COLORS.normal
}
