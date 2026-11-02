import type { StatName } from '../types/pokemon'

/** Plus haute stat de base possible (PV de Leuphorie). */
export const MAX_BASE_STAT = 255

export const STAT_LABELS: Readonly<Record<StatName, string>> = {
  hp: 'PV',
  attack: 'Attaque',
  defense: 'Défense',
  'special-attack': 'Att. Spé.',
  'special-defense': 'Déf. Spé.',
  speed: 'Vitesse',
}

/** Largeur de la barre en %, entre 0 et 100. */
export function statPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(100, Math.round((value / MAX_BASE_STAT) * 100))
}

export type StatLevel = 'low' | 'mid' | 'high'

/** Niveau d'une stat : < 60 faible, 60–99 moyen, ≥ 100 élevé. */
export function statLevel(value: number): StatLevel {
  if (value >= 100) return 'high'
  if (value >= 60) return 'mid'
  return 'low'
}

export function totalStats(stats: Readonly<Record<StatName, number>>): number {
  return Object.values(stats).reduce((sum, value) => sum + value, 0)
}
