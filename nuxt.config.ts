// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/i18n'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    /** PokéAPI, appelée par le serveur Nuxt ; surchargeable avec NUXT_POKEAPI_BASE. */
    pokeapiBase: 'https://pokeapi.co/api/v2',
    public: {
      /** URL de l'API Hono ; surchargeable avec NUXT_PUBLIC_API_BASE. */
      apiBase: 'http://localhost:3001',
    },
  },
  i18n: {
    // Mêmes URL dans les deux langues ; la langue est mémorisée dans un cookie.
    strategy: 'no_prefix',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'fr',
    },
  },
})
