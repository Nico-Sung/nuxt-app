import { serve } from '@hono/node-server'
import { app } from './app.js'
import { databaseHost } from './postgresStore.js'

const port = Number(process.env.PORT) || 3001
const databaseUrl = process.env.DATABASE_URL

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API prête sur http://localhost:${info.port}`)
  console.log(
    `Stockage : ${databaseUrl ? `Postgres (${databaseHost(databaseUrl)})` : 'mémoire'}`,
  )
})
