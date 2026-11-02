import type { Pokemon } from '../types/pokemon'

/** Minuscules, sans accents, tirets remplacés par des espaces. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/-/g, ' ')
    .toLowerCase()
    .trim()
}

export const MIN_QUERY_LENGTH = 2

/**
 * Recherche par nom (partielle) ou par numéro (exact).
 * Les noms qui commencent par la recherche passent en premier.
 */
export function searchPokemon(list: readonly Pokemon[], query: string, limit = 20): Pokemon[] {
  const q = normalizeText(query).replace(/^#\s*/, '') // "#025" -> "025"
  if (!q) return []

  if (/^\d+$/.test(q)) {
    const id = Number(q)
    return list.filter(p => p.id === id).slice(0, limit)
  }

  if (q.length < MIN_QUERY_LENGTH) return []

  const startsWith: Pokemon[] = []
  const contains: Pokemon[] = []
  for (const p of list) {
    const name = normalizeText(p.name)
    if (name.startsWith(q)) startsWith.push(p)
    else if (name.includes(q)) contains.push(p)
  }
  return [...startsWith, ...contains].slice(0, limit)
}
