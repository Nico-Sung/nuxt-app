// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // L'API Hono (api/) est un package séparé : hors config ESLint Nuxt.
  { ignores: ['api/**'] },
  {
    rules: {
      // Pas de logs de debug ni de points d'arrêt dans le code poussé.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      // Le format des balises (<img />) est géré par Prettier.
      'vue/html-self-closing': 'off',
    },
  },
)
