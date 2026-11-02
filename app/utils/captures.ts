import type { Pokemon } from '#shared/types/pokemon'

export type CaptureStatus = 'tous' | 'a-capturer' | 'captures'

export interface CaptureFilter {
  status: CaptureStatus
  search: string
}

/** Ajoute l'id s'il est absent, le retire sinon. Ne modifie pas le tableau reçu. */
export function toggleCapture(captured: readonly number[], id: number): number[] {
  return captured.includes(id)
    ? captured.filter(c => c !== id)
    : [...captured, id]
}

/** Minuscules + suppression des accents. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function filterPokemon(
  list: readonly Pokemon[],
  captured: readonly number[],
  { status, search }: CaptureFilter,
): Pokemon[] {
  const query = normalize(search)
  const capturedSet = new Set(captured)

  return list.filter((p) => {
    const isCaptured = capturedSet.has(p.id)
    if (status === 'a-capturer' && isCaptured) return false
    if (status === 'captures' && !isCaptured) return false
    if (!query) return true
    return normalize(p.name).includes(query) || String(p.id) === query
  })
}

export function progress(list: readonly Pokemon[], captured: readonly number[]) {
  const ids = new Set(list.map(p => p.id))
  const count = captured.filter(id => ids.has(id)).length
  const total = list.length
  return {
    captured: count,
    total,
    percent: total === 0 ? 0 : Math.round((count / total) * 100),
  }
}
