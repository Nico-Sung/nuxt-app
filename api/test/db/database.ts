import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { connect } from '../../src/postgresStore.js'

export const DEFAULT_TEST_DATABASE_URL =
  'postgres://postgres:postgres@localhost:54329/wishlist_test'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * URL de la base de test. Refuse tout ce qui ne ressemble pas à une base
 * locale dédiée aux tests : les tests vident la table à chaque fois.
 */
export function testDatabaseUrl(): string {
  const raw = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL
  const url = new URL(raw)
  const database = url.pathname.slice(1)

  if (!LOCAL_HOSTS.has(url.hostname) || !database.endsWith('_test')) {
    throw new Error(
      `Base refusée pour les tests (${url.hostname}/${database}) : ` +
        'il faut une base locale dont le nom finit par _test.',
    )
  }
  return raw
}

export function connectTestDatabase(): postgres.Sql {
  return connect(testDatabaseUrl())
}

const INIT_SQL = new URL('../../../supabase/init.sql', import.meta.url)

/** Applique le vrai schéma Supabase (supabase/init.sql) à la base de test. */
export async function applySchema(sql: postgres.Sql): Promise<void> {
  // Rôles fournis par Supabase, absents d'un Postgres standard.
  await sql
    .unsafe(
      `
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end
    $$;
  `,
    )
    .simple()
  await sql.unsafe(await readFile(INIT_SQL, 'utf8')).simple()
}

/** Vide la liste : chaque test part d'une table vide. */
export async function resetWishlist(sql: postgres.Sql): Promise<void> {
  await sql`truncate table public.wishlist`
}
