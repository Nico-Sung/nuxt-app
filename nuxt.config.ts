// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      /** URL de l'API Hono ; surchargeable avec NUXT_PUBLIC_API_BASE. */
      apiBase: 'http://localhost:3001',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Pokémon à capturer',
    },
  },
})
