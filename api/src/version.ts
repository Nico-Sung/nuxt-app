import { createRequire } from 'node:module'

// Lu à l'exécution : '../package.json' pointe sur api/package.json
// depuis src/ (dev, tests) comme depuis dist/ (build).
const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

/** Version de l'API, celle de api/package.json. */
export const VERSION: string = pkg.version

/** Hash court (7 caractères) du commit, ou "dev" si inconnu. */
export function shortSha(sha: string | undefined): string {
  const value = sha?.trim()
  return value ? value.slice(0, 7) : 'dev'
}
