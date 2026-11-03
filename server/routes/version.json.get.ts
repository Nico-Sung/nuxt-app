import type { FrontHealthResponse } from '../api/health.get'

/**
 * /version.json : comme /api/health, mais aussi généré en fichier pour le
 * site statique (S3 + CloudFront), où il n'y a pas de serveur.
 */
export default defineEventHandler((event): FrontHealthResponse => {
  const { appVersion, appCommit } = useRuntimeConfig(event)
  return { status: 'ok', version: appVersion, commit: appCommit }
})
