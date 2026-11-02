import type { WishlistItem } from '#shared/types/wishlist'

/**
 * Nombre maximum de Pokémon dans la liste (une équipe).
 * La règle est appliquée par l'API ; le front s'en sert pour griser l'ajout.
 */
export const MAX_WISHLIST_SIZE = 6

export function isWishlistFull(list: readonly WishlistItem[]): boolean {
  return list.length >= MAX_WISHLIST_SIZE
}

/** Retire l'entrée du Pokémon donné. Ne modifie pas le tableau reçu. */
export function removeFromWishlist(
  list: readonly WishlistItem[],
  pokemonId: number,
): WishlistItem[] {
  return list.filter((item) => item.pokemon.id !== pokemonId)
}

/** Copie triée : les derniers ajoutés en premier. */
export function sortByMostRecent(
  list: readonly WishlistItem[],
): WishlistItem[] {
  return [...list].sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
}
