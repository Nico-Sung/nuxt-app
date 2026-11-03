import { createRequire } from 'node:module'

/** Version lue dans api/package.json (dev, tests, build Node). */
function packageVersion(): string {
  // '../package.json' : api/package.json depuis src/ comme depuis dist/.
  const require = createRequire(import.meta.url)
  return (require('../package.json') as { version: string }).version
}

/**
 * Version de l'API. Sur Lambda, package.json n'est pas dans le paquet :
 * APP_VERSION est fournie au déploiement.
 */
export const VERSION: string = process.env.APP_VERSION || packageVersion()

/** Hash court (7 caractères) du commit, ou "dev" si inconnu. */
export function shortSha(sha: string | undefined): string {
  const value = sha?.trim()
  return value ? value.slice(0, 7) : 'dev'
}
