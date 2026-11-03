import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { handle, type LambdaContext, type LambdaEvent } from 'hono/aws-lambda'
import { createApp, DEFAULT_CORS_ORIGIN, storeFromEnv } from './app.js'
import { shortSha, VERSION } from './version.js'

/**
 * Point d'entrée AWS Lambda (derrière API Gateway HTTP API).
 *
 * Variables d'environnement (posées par infra/) :
 * - DATABASE_URL_PARAMETER : nom du paramètre SSM (SecureString) contenant
 *   l'URL Supabase ; jamais en clair dans la configuration de la Lambda ;
 * - CORS_ORIGIN, APP_VERSION, GIT_SHA.
 */

/** URL de la base : DATABASE_URL si présente, sinon lue (déchiffrée) dans SSM. */
export async function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  ssm: Pick<SSMClient, 'send'> = new SSMClient({}),
): Promise<string | undefined> {
  if (env.DATABASE_URL) return env.DATABASE_URL
  const name = env.DATABASE_URL_PARAMETER
  if (!name) return undefined

  const { Parameter } = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  )
  if (!Parameter?.Value) throw new Error(`Paramètre SSM vide : ${name}`)
  return Parameter.Value
}

async function createHandler() {
  const app = createApp({
    version: VERSION,
    commit: shortSha(process.env.GIT_SHA),
    corsOrigin: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
    store: storeFromEnv(await resolveDatabaseUrl()),
  })
  return handle(app)
}

/** Créé au premier appel puis réutilisé tant que l'instance Lambda vit. */
let ready: ReturnType<typeof createHandler> | undefined

export async function handler(event: LambdaEvent, context?: LambdaContext) {
  ready ??= createHandler().catch((error: unknown) => {
    ready = undefined // SSM indisponible : on réessaiera au prochain appel
    throw error
  })
  return (await ready)(event, context)
}
