// Ports dédiés aux tests E2E (3000/3001 sont souvent pris en local).
export const NUXT_PORT = 3200
export const API_PORT = 3201
export const POKEAPI_PORT = 3202
export const NUXT_URL = `http://localhost:${NUXT_PORT}`
export const API_URL = `http://localhost:${API_PORT}`
/** Faux PokéAPI (e2e/fake-pokeapi.mjs), appelé par le serveur Nuxt. */
export const POKEAPI_URL = `http://localhost:${POKEAPI_PORT}`
