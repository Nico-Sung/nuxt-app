import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type postgres from 'postgres'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  appliedMigrations,
  migrate,
  MIGRATIONS_DIR,
  MigrationError,
} from '../../src/migrations.js'
import { connectTestDatabase, createSupabaseRoles } from './database.js'

/**
 * Runner de migrations sur une vraie base Postgres (base de test isolée).
 * Chaque test part d'une base vide ; à la fin, la base est remise à jour
 * (toutes les migrations) pour les autres fichiers de tests.
 */

let sql: postgres.Sql
let dir: string | undefined

async function resetDatabase() {
  await sql
    .unsafe(
      `drop table if exists public.pokemon_likes, public.wishlist, public.schema_migrations cascade;
       drop table if exists public.partielle cascade;
       drop function if exists public.wishlist_enforce_max_size() cascade;`,
    )
    .simple()
}

/** Copie des vraies migrations + fichiers en plus (ou en remplacement). */
function migrationsWith(files: Record<string, string> = {}) {
  dir = mkdtempSync(join(tmpdir(), 'migrations-'))
  cpSync(MIGRATIONS_DIR, dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
  return dir
}

/** Seulement certaines migrations (ex. l'état avant 001). */
function onlyMigrations(...names: string[]) {
  dir = mkdtempSync(join(tmpdir(), 'migrations-'))
  for (const name of names) cpSync(join(MIGRATIONS_DIR, name), join(dir, name))
  return dir
}

const tableExists = async (name: string) => {
  const [row] = await sql<{ exists: boolean }[]>`
    select to_regclass(${`public.${name}`}) is not null as exists
  `
  return row?.exists
}

const wishlistRows = () =>
  sql<{ pokemon_id: number; name: string; added_at: Date }[]>`
    select pokemon_id, name, added_at from public.wishlist order by pokemon_id
  `

beforeAll(async () => {
  sql = connectTestDatabase()
  await createSupabaseRoles(sql)
})

beforeEach(resetDatabase)

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

afterAll(async () => {
  await resetDatabase()
  await migrate(sql)
  await sql.end()
})

describe('runner de migrations (Postgres réel)', () => {
  it('base vide : 000 puis 001 appliquées et notées dans schema_migrations', async () => {
    const result = await migrate(sql)

    expect(result).toEqual({ applied: ['000_init', '001_likes'], skipped: [] })
    expect(await tableExists('wishlist')).toBe(true)
    expect(await tableExists('pokemon_likes')).toBe(true)
    const applied = await appliedMigrations(sql)
    expect(applied.map((m) => m.version)).toEqual(['000', '001'])
  })

  it('deuxième passage : rien n’est exécuté, les dates ne bougent pas', async () => {
    await migrate(sql)
    const before = await appliedMigrations(sql)

    const result = await migrate(sql)

    expect(result).toEqual({ applied: [], skipped: ['000_init', '001_likes'] })
    expect(await appliedMigrations(sql)).toEqual(before)
  })

  it('001 sur une base qui a déjà des données : la liste est préservée', async () => {
    // état « avant les likes » : seulement 000, avec une vraie liste
    await migrate(sql, { dir: onlyMigrations('000_init.sql') })
    await sql`
      insert into public.wishlist (pokemon_id, name, sprite)
      values (25, 'Pikachu', '25.png'), (133, 'Eevee', '133.png')
    `
    const before = await wishlistRows()
    expect(await tableExists('pokemon_likes')).toBe(false)

    const result = await migrate(sql)

    expect(result).toEqual({ applied: ['001_likes'], skipped: ['000_init'] })
    expect(await wishlistRows()).toEqual(before)
    expect(await tableExists('pokemon_likes')).toBe(true)
  })

  it('relancer ne touche ni la liste ni les likes', async () => {
    await migrate(sql)
    await sql`insert into public.wishlist (pokemon_id, name, sprite) values (25, 'Pikachu', '25.png')`
    await sql`insert into public.pokemon_likes (pokemon_id, likes) values (25, 3), (143, 1)`
    const wishlist = await wishlistRows()

    await migrate(sql)
    await migrate(sql)

    expect(await wishlistRows()).toEqual(wishlist)
    expect(
      await sql`select pokemon_id, likes from public.pokemon_likes order by pokemon_id`,
    ).toEqual([
      { pokemon_id: 25, likes: 3 },
      { pokemon_id: 143, likes: 1 },
    ])
  })

  it('migration en erreur : tout est annulé, rien n’est noté, les précédentes restent', async () => {
    const broken = migrationsWith({
      '002_cassee.sql': 'create table public.partielle (id int); select 1 / 0;',
    })

    await expect(migrate(sql, { dir: broken })).rejects.toThrow(
      /002_cassee a échoué et a été annulée : division by zero/,
    )

    expect(await tableExists('partielle')).toBe(false)
    const applied = await appliedMigrations(sql)
    expect(applied.map((m) => m.version)).toEqual(['000', '001'])
  })

  it('fichier modifié après application : refus, rien n’est exécuté', async () => {
    await migrate(sql)
    const changed = migrationsWith({
      '001_likes.sql': 'drop table public.wishlist;',
      '002_suivante.sql': 'create table public.partielle (id int);',
    })

    await expect(migrate(sql, { dir: changed })).rejects.toThrow(MigrationError)
    await expect(migrate(sql, { dir: changed })).rejects.toThrow(
      /001_likes a déjà été appliquée mais son fichier a changé/,
    )
    expect(await tableExists('wishlist')).toBe(true)
    expect(await tableExists('partielle')).toBe(false)
  })

  it('deux runners en même temps : chaque migration n’est appliquée qu’une fois', async () => {
    const other = connectTestDatabase()
    try {
      const [a, b] = await Promise.all([migrate(sql), migrate(other)])

      expect([...a.applied, ...b.applied].sort()).toEqual([
        '000_init',
        '001_likes',
      ])
      expect([...a.skipped, ...b.skipped].sort()).toEqual([
        '000_init',
        '001_likes',
      ])
      expect(await appliedMigrations(sql)).toHaveLength(2)
    } finally {
      await other.end()
    }
  })

  it('la table des likes refuse un nombre négatif', async () => {
    await migrate(sql)
    await expect(
      sql`insert into public.pokemon_likes (pokemon_id, likes) values (25, -1)`,
    ).rejects.toMatchObject({ code: '23514' })
  })
})
