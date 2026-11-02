import type { Pokemon } from '#shared/types/pokemon'
import type { WishlistItem } from '#shared/types/wishlist'

/** Nombre maximum de Pokémon dans la liste (une équipe). */
export const MAX_WISHLIST_SIZE = 6

export type AddStatus = 'added' | 'duplicate' | 'full'

export interface AddResult {
  readonly status: AddStatus
  readonly list: WishlistItem[]
}

/**
 * Ajoute le Pokémon à la liste. Ne modifie pas le tableau reçu.
 * - déjà présent -> 'duplicate' (liste inchangée)
 * - liste pleine (MAX_WISHLIST_SIZE) -> 'full' (liste inchangée)
 * - sinon -> 'added'
 */
export function addToWishlist(
  list: readonly WishlistItem[],
  pokemon: Pokemon,
  now: Date = new Date(),
): AddResult {
  if (list.some((item) => item.pokemon.id === pokemon.id)) {
    return { status: 'duplicate', list: [...list] }
  }
  if (list.length >= MAX_WISHLIST_SIZE) {
    return { status: 'full', list: [...list] }
  }
  return {
    status: 'added',
    list: [...list, { pokemon, addedAt: now.toISOString() }],
  }
}

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
 * - au-delà de MAX_WISHLIST_SIZE, seules les premières entrées sont gardées
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
    if (items.length >= MAX_WISHLIST_SIZE) break
    let item: WishlistItem | null = null
    if (isWishlistItem(entry)) item = toItem(entry.pokemon, entry.addedAt)
    else if (isPokemon(entry)) item = toItem(entry, now.toISOString())

    if (item && !items.some((i) => i.pokemon.id === item.pokemon.id)) {
      items.push(item)
    }
  }
  return items
}
