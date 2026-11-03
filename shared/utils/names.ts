import data from '../data/pokemon-names.json'

/**
 * Noms officiels traduits (shared/data/pokemon-names.json, généré par
 * scripts/generate-pokemon-names.mjs) : aucun appel à PokéAPI à l'exécution.
 */
type Names = Partial<Record<string, string>>

/** Langues présentes dans le fichier (`slug`, le nom d'URL, n'en est pas une). */
const NAME_LANGUAGES = ['en', 'fr'] as const

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
  const translated = lang === 'slug' ? undefined : names?.[lang]
  return translated ?? names?.en ?? fallback
}

/** Tous les noms connus d'un Pokémon, pour chercher dans toutes les langues. */
export function pokemonNames(id: number): string[] {
  const names = SPECIES[String(id)] ?? {}
  return NAME_LANGUAGES.map((lang) => names[lang]).filter(
    (name): name is string => Boolean(name),
  )
}

/** Toutes les espèces : numéro + nom d'URL de la forme par défaut ("deoxys-normal"). */
export function speciesSlugs(): { id: number; slug: string }[] {
  return Object.entries(SPECIES)
    .map(([id, names]) => ({ id: Number(id), slug: names.slug ?? '' }))
    .filter(({ slug }) => slug !== '')
    .sort((a, b) => a.id - b.id)
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
