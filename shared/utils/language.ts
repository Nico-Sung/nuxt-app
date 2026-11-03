/** Langues de l'app ; l'anglais sert de repli pour les textes PokéAPI. */
export const APP_LANGUAGES = ['fr', 'en'] as const
export type AppLanguage = (typeof APP_LANGUAGES)[number]

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (APP_LANGUAGES as readonly unknown[]).includes(value)
}
