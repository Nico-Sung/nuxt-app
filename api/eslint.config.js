// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'dist-lambda/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Pas de logs de debug ni de points d'arrêt dans le code poussé.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },
  {
    // Point d'entrée du serveur : le message de démarrage est voulu.
    files: ['src/index.ts', 'src/migrate.ts'],
    rules: { 'no-console': 'off' },
  },
)
