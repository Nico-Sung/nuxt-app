import { Hono } from 'hono'
import { shortSha, VERSION } from './version.js'

export interface HealthResponse {
  status: 'ok'
  version: string
  commit: string
}

export interface AppOptions {
  version: string
  commit: string
}

export function createApp({ version, commit }: AppOptions) {
  const app = new Hono()

  app.get('/health', (c) =>
    c.json<HealthResponse>({ status: 'ok', version, commit }),
  )

  app.notFound((c) => c.json({ error: 'Not Found' }, 404))

  return app
}

/** App configurée à partir de package.json et de la variable GIT_SHA. */
export const app = createApp({
  version: VERSION,
  commit: shortSha(process.env.GIT_SHA),
})
