import type {
  Pokemon,
  PokeApiListItem,
  PokeApiLocalized,
  PokeApiPokemonProfileResponse,
  PokeApiPokemonResponse,
  PokeApiSpeciesResponse,
  PokemonDetails,
  PokemonProfile,
  StatName,
} from '../types/pokemon'
import { STAT_NAMES } from '../types/pokemon'
import { isPokemonTypeName } from './types'

const SPRITES_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

/** Extrait l'id d'une URL PokéAPI, ex. ".../pokemon/25/" -> 25 */
export function idFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/)
  if (!match) throw new Error(`URL PokéAPI invalide : ${url}`)
  return Number(match[1])
}

/** "mr-mime" -> "Mr Mime", "bulbasaur" -> "Bulbasaur" */
export function formatName(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Illustration officielle (grande taille). */
export function spriteUrl(id: number): string {
  return `${SPRITES_BASE}/other/official-artwork/${id}.png`
}

/** Petit sprite de jeu, utilisé en secours si l'illustration manque. */
export function smallSpriteUrl(id: number): string {
  return `${SPRITES_BASE}/${id}.png`
}

export function toPokemon(item: PokeApiListItem): Pokemon {
  const id = idFromUrl(item.url)
  return { id, name: formatName(item.name), sprite: spriteUrl(id) }
}

/**
 * Transforme la réponse de GET /pokemon/{id} en PokemonDetails.
 * - types triés par slot, types inconnus ignorés (repli sur « normal »)
 * - stat absente -> 0
 */
export function toPokemonDetails(data: PokeApiPokemonResponse): PokemonDetails {
  const types = [...data.types]
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name)
    .filter(isPokemonTypeName)

  const byName = new Map(data.stats.map((s) => [s.stat.name, s.base_stat]))
  const stats = Object.fromEntries(
    STAT_NAMES.map((name) => [name, byName.get(name) ?? 0]),
  ) as Record<StatName, number>

  return {
    id: data.id,
    types: types.length ? types : ['normal'],
    stats,
    height: data.height,
    weight: data.weight,
  }
}

/** Nom PokéAPI valide dans une URL : minuscules, chiffres et tirets ("mr-mime"). */
export function isPokemonSlug(value: string): boolean {
  return value.length <= 50 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

/** "Mr Mime" -> "mr-mime" : l'inverse de formatName, pour les liens. */
export function pokemonSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

/** Langues de l'app ; l'anglais sert de repli pour les textes PokéAPI. */
export const APP_LANGUAGES = ['fr', 'en'] as const
export type AppLanguage = (typeof APP_LANGUAGES)[number]

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (APP_LANGUAGES as readonly unknown[]).includes(value)
}

/** Langues des textes de la fiche, par ordre de préférence : demandée, puis anglais. */
export function profileLanguages(lang: AppLanguage): string[] {
  return lang === 'en' ? ['en'] : [lang, 'en']
}

/**
 * Entrée dans la première langue disponible ; pour une langue donnée,
 * la plus récente (PokéAPI les range du plus ancien jeu au plus récent).
 */
export function pickLocalized<T extends PokeApiLocalized>(
  entries: readonly T[],
  languages: readonly string[],
): T | undefined {
  for (const language of languages) {
    const matches = entries.filter((e) => e.language.name === language)
    if (matches.length) return matches[matches.length - 1]
  }
  return undefined
}

/**
 * Nettoie un texte du Pokédex : PokéAPI garde les retours à la ligne
 * et sauts de page (\f) des jeux, et des césures (trait d'union conditionnel).
 */
export function cleanFlavorText(text: string): string {
  return text
    .replace(/\u00ad\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Transforme GET /pokemon/{name} (+ GET /pokemon-species/{id}) en fiche.
 * Catégorie et description dans la langue demandée, sinon en anglais ;
 * sans espèce (indisponible), la fiche n'a ni l'une ni l'autre.
 */
export function toPokemonProfile(
  data: PokeApiPokemonProfileResponse,
  species: PokeApiSpeciesResponse | null,
  lang: AppLanguage = 'fr',
): PokemonProfile {
  const languages = profileLanguages(lang)
  const flavor =
    species && pickLocalized(species.flavor_text_entries, languages)
  const genus = species && pickLocalized(species.genera, languages)

  return {
    ...toPokemonDetails(data),
    slug: data.name,
    name: formatName(data.name),
    sprite: spriteUrl(data.id),
    genus: genus ? genus.genus : null,
    description: flavor ? cleanFlavorText(flavor.flavor_text) : null,
    abilities: [...data.abilities]
      .sort((a, b) => a.slot - b.slot)
      .map((a) => ({ name: formatName(a.ability.name), hidden: a.is_hidden })),
  }
}
