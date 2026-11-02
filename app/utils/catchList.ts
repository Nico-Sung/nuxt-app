import type { Pokemon } from '#shared/types/pokemon'

/** Ajoute le Pokémon s'il n'y est pas déjà. Ne modifie pas le tableau reçu. */
export function addPokemon(list: readonly Pokemon[], pokemon: Pokemon): Pokemon[] {
  return list.some(p => p.id === pokemon.id) ? [...list] : [...list, pokemon]
}

/** Retire le Pokémon d'id donné. Ne modifie pas le tableau reçu. */
export function removePokemon(list: readonly Pokemon[], id: number): Pokemon[] {
  return list.filter(p => p.id !== id)
}

function isPokemon(value: unknown): value is Pokemon {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return Number.isInteger(v.id) && typeof v.name === 'string' && typeof v.sprite === 'string'
}

/** Relit la liste stockée ; JSON absent, corrompu ou invalide -> entrées valides seulement (ou []). */
export function parseStoredList(raw: string | null): Pokemon[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPokemon).reduce<Pokemon[]>(addPokemon, [])
  }
  catch {
    return []
  }
}
