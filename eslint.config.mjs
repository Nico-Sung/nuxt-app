// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Pas de logs de debug ni de points d'arrêt dans le code poussé.
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
  },
})
