import type { PokemonTypeName } from '../types/pokemon'
import { POKEMON_TYPE_NAMES } from '../types/pokemon'

export interface TypeInfo {
  readonly label: string
  readonly color: string
}

/** Libellé français et couleur de chaque type. */
export const TYPE_INFO: Readonly<Record<PokemonTypeName, TypeInfo>> = {
  normal: { label: 'Normal', color: '#9099a1' },
  fire: { label: 'Feu', color: '#e8743b' },
  water: { label: 'Eau', color: '#4d90d5' },
  electric: { label: 'Électrik', color: '#d4a90c' },
  grass: { label: 'Plante', color: '#5fa94a' },
  ice: { label: 'Glace', color: '#5fb8ae' },
  fighting: { label: 'Combat', color: '#ce4069' },
  poison: { label: 'Poison', color: '#ab6ac8' },
  ground: { label: 'Sol', color: '#d97746' },
  flying: { label: 'Vol', color: '#8fa8dd' },
  psychic: { label: 'Psy', color: '#e5627a' },
  bug: { label: 'Insecte', color: '#8fb02a' },
  rock: { label: 'Roche', color: '#b5a56b' },
  ghost: { label: 'Spectre', color: '#5269ac' },
  dragon: { label: 'Dragon', color: '#0b6dc3' },
  dark: { label: 'Ténèbres', color: '#5a5366' },
  steel: { label: 'Acier', color: '#5a8ea1' },
  fairy: { label: 'Fée', color: '#d77fd0' },
}

export function isPokemonTypeName(value: string): value is PokemonTypeName {
  return (POKEMON_TYPE_NAMES as readonly string[]).includes(value)
}

/** Infos d'un type ; un type inconnu retombe sur « Normal ». */
export function typeInfo(name: string): TypeInfo {
  return isPokemonTypeName(name) ? TYPE_INFO[name] : TYPE_INFO.normal
}
