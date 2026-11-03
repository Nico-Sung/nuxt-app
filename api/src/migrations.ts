import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type postgres from 'postgres'

/**
 * Runner SQL maison : applique supabase/migrations/NNN_nom.sql dans l'ordre,
 * une seule fois chacune, et le note dans public.schema_migrations.
 *
 * - Chaque migration tourne dans sa propre transaction : en cas d'erreur,
 *   rien n'est appliqué ni noté (le DDL Postgres est transactionnel).
 * - Un verrou de transaction (pg_advisory_xact_lock) empêche deux runners
 *   lancés en même temps d'appliquer la même migration ; il fonctionne aussi
 *   derrière le pooler Supabase en mode transaction.
 * - Une migration déjà appliquée dont le fichier a changé (empreinte SHA-256)
 *   bloque tout : on ajoute une nouvelle migration, on ne réécrit pas l'ancienne.
 */

export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../supabase/migrations', import.meta.url),
)

/** "001_likes.sql" -> version "001", nom "likes". */
const FILE_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/

export interface Migration {
  version: string
  name: string
  file: string
  sql: string
  /** SHA-256 du contenu du fichier. */
  checksum: string
}

export interface AppliedMigration {
  version: string
  name: string
  checksum: string
  appliedAt: Date
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

export class MigrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'MigrationError'
  }
}

export const checksum = (sql: string) =>
  createHash('sha256').update(sql).digest('hex')

const label = (m: { version: string; name: string }) => `${m.version}_${m.name}`

/** Lit et valide les fichiers de migration, triés par numéro. */
export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const migrations: Migration[] = []
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.sql')) continue
    const match = FILE_PATTERN.exec(file)
    if (!match) {
      throw new MigrationError(
        `Nom de migration invalide : ${file} (attendu : 001_nom.sql)`,
      )
    }
    const [, version = '', name = ''] = match
    if (migrations.some((m) => m.version === version)) {
      throw new MigrationError(`Numéro de migration en double : ${version}`)
    }
    const sql = readFileSync(join(dir, file), 'utf8')
    migrations.push({ version, name, file, sql, checksum: checksum(sql) })
  }
  return migrations.sort((a, b) => a.version.localeCompare(b.version))
}

const LOCK = "pg_advisory_xact_lock(hashtext('public.schema_migrations'))"

/** Crée public.schema_migrations si besoin (sous verrou : runners concurrents). */
async function ensureMigrationsTable(sql: postgres.Sql) {
  await sql.begin(async (tx) => {
    await tx.unsafe(`select ${LOCK}`)
    await tx
      .unsafe(
        `
      create table if not exists public.schema_migrations (
        version text primary key,
        name text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      );
      alter table public.schema_migrations enable row level security;
    `,
      )
      .simple()
  })
}

/** Migrations déjà notées dans la base. */
export async function appliedMigrations(
  sql: postgres.Sql,
): Promise<AppliedMigration[]> {
  await ensureMigrationsTable(sql)
  const rows = await sql<
    { version: string; name: string; checksum: string; applied_at: Date }[]
  >`
    select version, name, checksum, applied_at
    from public.schema_migrations
    order by version
  `
  return rows.map((r) => ({
    version: r.version,
    name: r.name,
    checksum: r.checksum,
    appliedAt: new Date(r.applied_at),
  }))
}

/** Une migration appliquée a-t-elle été modifiée depuis ? */
function assertUnchanged(migration: Migration, appliedChecksum: string) {
  if (appliedChecksum !== migration.checksum) {
    throw new MigrationError(
      `La migration ${label(migration)} a déjà été appliquée mais son fichier a changé ` +
        '(empreinte différente). Ne modifie pas une migration appliquée : ajoute-en une nouvelle.',
    )
  }
}

/** Applique les migrations en attente, dans l'ordre. */
export async function migrate(
  sql: postgres.Sql,
  options: { dir?: string; log?: (line: string) => void } = {},
): Promise<MigrationResult> {
  const { dir = MIGRATIONS_DIR, log = () => {} } = options
  const migrations = loadMigrations(dir)

  // Avant toute exécution : aucune migration appliquée n'a été modifiée.
  const already = new Map(
    (await appliedMigrations(sql)).map((m) => [m.version, m.checksum]),
  )
  for (const migration of migrations) {
    const applied = already.get(migration.version)
    if (applied) assertUnchanged(migration, applied)
  }

  const result: MigrationResult = { applied: [], skipped: [] }
  for (const migration of migrations) {
    await sql
      .begin(async (tx) => {
        await tx.unsafe(`select ${LOCK}`)
        // Revérifié sous verrou : un autre runner a pu l'appliquer entre-temps.
        const [row] = await tx<{ checksum: string }[]>`
          select checksum from public.schema_migrations
          where version = ${migration.version}
        `
        if (row) {
          assertUnchanged(migration, row.checksum)
          result.skipped.push(label(migration))
          log(`= ${label(migration)} (déjà appliquée)`)
          return
        }
        await tx.unsafe(migration.sql).simple()
        await tx`
          insert into public.schema_migrations (version, name, checksum)
          values (${migration.version}, ${migration.name}, ${migration.checksum})
        `
        result.applied.push(label(migration))
        log(`+ ${label(migration)} appliquée`)
      })
      .catch((error: unknown) => {
        if (error instanceof MigrationError) throw error
        const detail = error instanceof Error ? error.message : String(error)
        throw new MigrationError(
          `La migration ${label(migration)} a échoué et a été annulée : ${detail}`,
          { cause: error },
        )
      })
  }
  return result
}

export interface MigrationStatus {
  version: string
  name: string
  appliedAt: Date | null
}

/** État de chaque migration (sans rien exécuter). */
export async function migrationStatus(
  sql: postgres.Sql,
  dir = MIGRATIONS_DIR,
): Promise<MigrationStatus[]> {
  const applied = new Map(
    (await appliedMigrations(sql)).map((m) => [m.version, m]),
  )
  return loadMigrations(dir).map((m) => {
    const row = applied.get(m.version)
    if (row) assertUnchanged(m, row.checksum)
    return {
      version: m.version,
      name: m.name,
      appliedAt: row?.appliedAt ?? null,
    }
  })
}
