const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** Taille PokéAPI (décimètres) -> « 0,4 m ». */
export function formatHeight(decimeters: number): string {
  return `${decimal.format(decimeters / 10)}\u00a0m`
}

/** Poids PokéAPI (hectogrammes) -> « 6 kg ». */
export function formatWeight(hectograms: number): string {
  return `${decimal.format(hectograms / 10)}\u00a0kg`
}

/** 25 -> « #025 ». */
export function formatNumber(id: number): string {
  return `#${String(id).padStart(3, '0')}`
}
