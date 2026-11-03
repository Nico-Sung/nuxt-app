import type postgres from 'postgres'
import { applySchema, connectTestDatabase, resetWishlist } from './database.js'

/**
 * Vitest masque parfois le message d'une erreur levée ici (bug de source map) :
 * on l'affiche d'abord nous-mêmes.
 */
function fail(message: string, cause?: unknown): never {
  console.error(`\n✖ ${message}\n`)
  throw new Error(message, { cause })
}

/** Une fois avant tous les tests : schéma à jour ; une fois après : table vide. */
export default async function setup() {
  let sql: postgres.Sql
  try {
    sql = connectTestDatabase()
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }

  try {
    await applySchema(sql)
    await resetWishlist(sql)
  } catch (error) {
    await sql.end({ timeout: 1 })
    // ECONNREFUSED arrive avec un message vide : on affiche alors son code.
    const { message, code } = error as { message?: string; code?: string }
    const detail = message || code || String(error)
    fail(
      `Base de test injoignable ou schéma invalide (${detail}). ` +
        'Démarre-la avec `npm run db:test:up`.',
      error,
    )
  }

  return async () => {
    await resetWishlist(sql)
    await sql.end()
  }
}
