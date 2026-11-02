import type { Pokemon } from '#shared/types/pokemon'
import type { WishlistItem } from '#shared/types/wishlist'

/** Ajoute le Pokémon s'il n'y est pas déjà. Ne modifie pas le tableau reçu. */
export function addToWishlist(
  list: readonly WishlistItem[],
  pokemon: Pokemon,
  now: Date = new Date(),
): WishlistItem[] {
  if (list.some((item) => item.pokemon.id === pokemon.id)) return [...list]
  const addedAt: number = now.toISOString()
  return [...list, { pokemon, addedAt }]
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPokemon(value: unknown): value is Pokemon {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    typeof value.name === 'string' &&
    typeof value.sprite === 'string'
  )
}

function isWishlistItem(value: unknown): value is WishlistItem {
  return (
    isRecord(value) &&
    isPokemon(value.pokemon) &&
    typeof value.addedAt === 'string' &&
    !Number.isNaN(Date.parse(value.addedAt))
  )
}

/** Ne garde que les champs connus (ignore ce qui traînerait dans le stockage). */
function toItem(pokemon: Pokemon, addedAt: string): WishlistItem {
  const { id, name, sprite } = pokemon
  return { pokemon: { id, name, sprite }, addedAt }
}

/**
 * Relit la liste stockée.
 * - JSON absent, corrompu ou qui n'est pas un tableau -> []
 * - entrées invalides ignorées, doublons supprimés
 * - ancien format (Pokemon[]) converti en WishlistItem daté de `now`
 */
export function parseStoredWishlist(
  raw: string | null,
  now: Date = new Date(),
): WishlistItem[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const items: WishlistItem[] = []
  for (const entry of parsed) {
    let item: WishlistItem | null = null
    if (isWishlistItem(entry)) item = toItem(entry.pokemon, entry.addedAt)
    else if (isPokemon(entry)) item = toItem(entry, now.toISOString())

    if (item && !items.some((i) => i.pokemon.id === item.pokemon.id)) {
      items.push(item)
    }
  }
  return items
}
