import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checksum, loadMigrations, MigrationError } from '../src/migrations.js'

let dir: string | undefined
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

function migrationsDir(files: Record<string, string>) {
  dir = mkdtempSync(join(tmpdir(), 'migrations-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
  return dir
}

describe('loadMigrations', () => {
  it('les vraies migrations : 000_init puis 001_likes', () => {
    expect(loadMigrations().map((m) => `${m.version}_${m.name}`)).toEqual([
      '000_init',
      '001_likes',
    ])
  })

  it('trie par numéro et calcule l’empreinte du contenu', () => {
    const migrations = loadMigrations(
      migrationsDir({
        '010_c.sql': 'select 3;',
        '002_b.sql': 'select 2;',
        '001_a.sql': 'select 1;',
        'LISEZMOI.md': 'ignoré',
      }),
    )
    expect(migrations.map((m) => m.version)).toEqual(['001', '002', '010'])
    expect(migrations[0]?.checksum).toBe(checksum('select 1;'))
    expect(checksum('select 1;')).not.toBe(checksum('select 1; '))
  })

  it.each(['1_a.sql', '001-likes.sql', '001_Likes.sql', 'likes.sql'])(
    'refuse un nom mal formé : %s',
    (file) => {
      expect(() =>
        loadMigrations(migrationsDir({ [file]: 'select 1;' })),
      ).toThrow(MigrationError)
    },
  )

  it('refuse deux migrations avec le même numéro', () => {
    expect(() =>
      loadMigrations(
        migrationsDir({ '001_a.sql': 'select 1;', '001_b.sql': 'select 2;' }),
      ),
    ).toThrow('Numéro de migration en double : 001')
  })
})
