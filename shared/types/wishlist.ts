import type { Pokemon } from './pokemon'

/** Une entrée de la liste de Pokémon à capturer. */
export interface WishlistItem {
  readonly pokemon: Pokemon
  /** Date d'ajout au format ISO 8601, ex. "2026-11-02T10:15:00.000Z". */
  readonly addedAt: string
}
