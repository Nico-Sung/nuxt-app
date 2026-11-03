const formatters = new Map<string, Intl.NumberFormat>()

/** Nombre à une décimale au plus, selon la langue (« 0,4 » / « 0.4 »). */
function decimal(locale: string): Intl.NumberFormat {
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    formatters.set(locale, formatter)
  }
  return formatter
}

/** Taille PokéAPI (décimètres) -> « 0,4 m » (fr) / « 0.4 m » (en). */
export function formatHeight(decimeters: number, locale = 'fr'): string {
  return `${decimal(locale).format(decimeters / 10)}\u00a0m`
}

/** Poids PokéAPI (hectogrammes) -> « 6 kg ». */
export function formatWeight(hectograms: number, locale = 'fr'): string {
  return `${decimal(locale).format(hectograms / 10)}\u00a0kg`
}

/** 25 -> « #025 ». */
export function formatNumber(id: number): string {
  return `#${String(id).padStart(3, '0')}`
}
