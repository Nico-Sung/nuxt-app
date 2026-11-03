/**
 * npm run migrate            applique les migrations en attente
 * npm run migrate -- --status   liste les migrations, sans rien exécuter
 *
 * Base : DATABASE_URL (api/.env en local : ton Supabase).
 */
import { connect, databaseHost } from './postgresStore.js'
import { migrate, MigrationError, migrationStatus } from './migrations.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL manquante (api/.env).')
  process.exit(1)
}

const sql = connect(url)
console.log(`Base : ${databaseHost(url)}`)

try {
  if (process.argv.includes('--status')) {
    for (const m of await migrationStatus(sql)) {
      const state = m.appliedAt
        ? `appliquée le ${m.appliedAt.toISOString()}`
        : 'en attente'
      console.log(`  ${m.version}_${m.name} : ${state}`)
    }
  } else {
    const { applied, skipped } = await migrate(sql, {
      log: (line) => console.log(`  ${line}`),
    })
    console.log(
      `${applied.length} appliquée(s), ${skipped.length} déjà appliquée(s).`,
    )
  }
} catch (error) {
  console.error(error instanceof MigrationError ? error.message : error)
  process.exitCode = 1
} finally {
  await sql.end()
}
