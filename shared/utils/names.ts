import data from '../data/pokemon-names.json'

/**
 * Noms officiels traduits (shared/data/pokemon-names.json, généré par
 * scripts/generate-pokemon-names.mjs) : aucun appel à PokéAPI à l'exécution.
 */
type Names = Partial<Record<string, string>>

const SPECIES: Readonly<Record<string, Names>> = data.species
const ABILITIES: Readonly<Record<string, Names>> = data.abilities

/**
 * Nom d'un Pokémon dans la langue : « Bulbizarre » (fr), « Bulbasaur » (en).
 * Formes sans nom traduit (méga, régionales…) : `fallback`.
 */
export function pokemonName(
  id: number,
  lang: string,
  fallback: string,
): string {
  const names = SPECIES[String(id)]
  return names?.[lang] ?? names?.en ?? fallback
}

/** Tous les noms connus d'un Pokémon, pour chercher dans toutes les langues. */
export function pokemonNames(id: number): string[] {
  return Object.values(SPECIES[String(id)] ?? {}).filter(
    (name): name is string => Boolean(name),
  )
}

/** Nom d'un talent dans la langue : « Statik » (fr), « Static » (en). */
export function abilityName(
  slug: string,
  lang: string,
  fallback: string,
): string {
  const names = ABILITIES[slug]
  return names?.[lang] ?? names?.en ?? fallback
}
