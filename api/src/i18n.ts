import { createRequire } from 'node:module'

/** Langues de l'API ; l'anglais est la référence et la langue par défaut. */
export const LANGUAGES = ['en', 'fr'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'en'

type Messages = { [key: string]: string | Messages }

// Lus depuis api/locales (même chemin relatif depuis src/ et dist/).
const require = createRequire(import.meta.url)
const MESSAGES: Record<Language, Messages> = {
  en: require('../locales/en.json') as Messages,
  fr: require('../locales/fr.json') as Messages,
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

export function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value)
}

/**
 * Texte traduit ; `{nom}` est remplacé par params.nom.
 * Clé absente dans la langue -> anglais ; absente partout -> la clé elle-même.
 */
export function translate(
  lang: string | undefined,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const language = isLanguage(lang) ? lang : DEFAULT_LANGUAGE
  const template =
    lookup(MESSAGES[language], key) ??
    lookup(MESSAGES[DEFAULT_LANGUAGE], key) ??
    key
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}
