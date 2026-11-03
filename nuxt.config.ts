import process from 'node:process'
import { fetchPokemonRoutes } from './build/pokemonRoutes'

const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

/**
 * Site statique (S3 + CloudFront) : `NUXT_PUBLIC_STATIC_SITE=1 nuxt generate`.
 * Sans serveur Nuxt, le navigateur appelle PokéAPI directement.
 */
const STATIC_SITE = process.env.NUXT_PUBLIC_STATIC_SITE === '1'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/i18n'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    /** Version et commit du build, renvoyés par /api/health (figés au build). */
    appVersion: process.env.npm_package_version ?? 'dev',
    appCommit: (process.env.GITHUB_SHA ?? 'dev').slice(0, 7),
    /** PokéAPI, appelée par le serveur Nuxt ; surchargeable avec NUXT_POKEAPI_BASE. */
    pokeapiBase: POKEAPI_BASE,
    public: {
      /** Site statique : pas de routes /api, voir usePokemonData. */
      staticSite: STATIC_SITE,
      /** PokéAPI appelée par le navigateur (site statique uniquement). */
      pokeapiBase: POKEAPI_BASE,
      /** URL de l'API Hono ; surchargeable avec NUXT_PUBLIC_API_BASE. */
      apiBase: 'http://localhost:3001',
    },
  },
  nitro: {
    prerender: {
      // Seules les routes injectées ci-dessous ; pas d'exploration des liens.
      crawlLinks: false,
      // Doux pour PokéAPI : 2 appels par fiche (Pokémon + espèce).
      concurrency: 8,
      failOnError: true,
    },
  },
  hooks: {
    /**
     * Fiches /pokemon/<nom> générées en HTML au build : uniquement si
     * PRERENDER_POKEMON=1 (job Deploy). Build, E2E et dev restent dynamiques.
     * PRERENDER_POKEMON_LIMIT=20 pour un essai local rapide.
     */
    async 'nitro:config'(nitroConfig) {
      // Site statique : l'accueil (pas d'exploration des liens) et la version
      // en ligne (/version.json, comme /api/health).
      if (STATIC_SITE) {
        nitroConfig.prerender ??= {}
        nitroConfig.prerender.routes = [
          ...(nitroConfig.prerender.routes ?? []),
          '/',
          '/version.json',
        ]
      }
      if (process.env.PRERENDER_POKEMON !== '1') return
      const limit = Number(process.env.PRERENDER_POKEMON_LIMIT) || undefined
      const routes = await fetchPokemonRoutes(POKEAPI_BASE, { limit })
      nitroConfig.prerender ??= {}
      nitroConfig.prerender.routes = [
        ...(nitroConfig.prerender.routes ?? []),
        ...routes,
      ]
      console.warn(`[prerender] ${routes.length} fiches Pokémon à générer`)
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
