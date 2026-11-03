import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  checkDirectory,
  compareMessages,
  placeholders,
  run,
} from '../scripts/check-locales.mjs'

const EN = {
  app: { title: 'Pokémon to catch' },
  card: { remove: 'Remove', removeLabel: 'Remove {name}' },
  home: { full: 'List full ({max} max)' },
}

const FR = {
  app: { title: 'Pokémon à capturer' },
  card: { remove: 'Retirer', removeLabel: 'Retirer {name}' },
  home: { full: 'Liste pleine ({max} max)' },
}

/** Copie profonde modifiable de FR. */
const fr = () => structuredClone(FR) as Record<string, Record<string, unknown>>

describe('compareMessages', () => {
  it('aucun problème quand les clés sont identiques', () => {
    expect(compareMessages(EN, FR)).toEqual([])
  })

  it('clé manquante', () => {
    const messages = fr()
    delete messages.card!.remove
    expect(compareMessages(EN, messages as never)).toEqual([
      { kind: 'missing', key: 'card.remove' },
    ])
  })

  it('groupe entier manquant : chaque clé est listée', () => {
    const messages = fr()
    delete messages.card
    expect(compareMessages(EN, messages as never)).toEqual([
      { kind: 'missing', key: 'card.remove' },
      { kind: 'missing', key: 'card.removeLabel' },
    ])
  })

  it('clé en trop (absente de en.json)', () => {
    const messages = fr()
    messages.card!.oublie = 'Clé morte'
    expect(compareMessages(EN, messages as never)).toEqual([
      { kind: 'extra', key: 'card.oublie' },
    ])
  })

  it('type différent : texte au lieu d’un groupe, et inversement', () => {
    const messages = fr()
    messages.app = 'Pokémon à capturer' as never
    messages.card!.remove = { court: 'Retirer' }
    expect(compareMessages(EN, messages as never).map((p) => p.kind)).toEqual([
      'type',
      'type',
    ])
  })

  it('variables différentes', () => {
    const messages = fr()
    messages.card!.removeLabel = 'Retirer {nom}'
    expect(compareMessages(EN, messages as never)).toEqual([
      {
        kind: 'placeholders',
        key: 'card.removeLabel',
        detail: 'attendu {name}, trouvé {nom}',
      },
    ])
  })

  it('texte vide', () => {
    const messages = fr()
    messages.app!.title = '  '
    expect(compareMessages(EN, messages as never)).toEqual([
      { kind: 'empty', key: 'app.title' },
    ])
  })

  it('valeur qui n’est pas un texte', () => {
    const messages = fr()
    messages.app!.title = 42
    expect(compareMessages(EN, messages as never)[0]?.kind).toBe('invalid')
  })
})

describe('placeholders', () => {
  it('liste les variables {x}, triées et sans doublon', () => {
    expect(placeholders('{name} ajouté. {full} {name}')).toEqual([
      'full',
      'name',
    ])
    expect(placeholders('Aucune variable')).toEqual([])
  })
})

describe('checkDirectory et run (vrais fichiers)', () => {
  let dir: string

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function locales(files: Record<string, unknown>) {
    dir = mkdtempSync(join(tmpdir(), 'locales-'))
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(
        join(dir, name),
        typeof content === 'string' ? content : JSON.stringify(content),
      )
    }
    return dir
  }

  const silent = () => {}

  it('dossier valide : 0 problème', () => {
    locales({ 'en.json': EN, 'fr.json': FR })
    expect(checkDirectory(dir).map((r) => r.problems)).toEqual([[], []])
    expect(run([dir], silent)).toBe(0)
  })

  it('compare chaque fichier à en.json (fr, de…)', () => {
    const messages = fr()
    delete messages.home
    locales({ 'en.json': EN, 'fr.json': FR, 'de.json': messages })

    const reports = checkDirectory(dir)
    expect(reports.map((r) => r.file.split('/').pop())).toEqual([
      'en.json',
      'de.json',
      'fr.json',
    ])
    expect(reports[1]?.problems).toEqual([
      { kind: 'missing', key: 'home.full' },
    ])
    expect(run([dir], silent)).toBe(1)
  })

  it('JSON invalide', () => {
    locales({ 'en.json': EN, 'fr.json': '{ "app": ' })
    expect(checkDirectory(dir)[1]?.problems[0]?.kind).toBe('invalid')
  })

  it('en.json absent', () => {
    locales({ 'fr.json': FR })
    expect(run([dir], silent)).toBe(1)
  })

  it('en.json avec un texte vide', () => {
    locales({ 'en.json': { app: { title: '' } } })
    expect(checkDirectory(dir)[0]?.problems).toEqual([
      { kind: 'empty', key: 'app.title' },
    ])
  })

  it('rapport lisible avec le fichier et la clé', () => {
    const messages = fr()
    delete messages.card!.remove
    locales({ 'en.json': EN, 'fr.json': messages })

    const lines: string[] = []
    run([dir], (line) => lines.push(line))
    expect(lines.join('\n')).toContain('✗ fr.json : 1 problème(s)')
    expect(lines.join('\n')).toContain('- clé manquante : card.remove')
  })
})

describe('les vraies langues du projet', () => {
  it('front et API : mêmes clés que en.json', () => {
    expect(run(['i18n/locales', 'api/src/locales'], () => {})).toBe(0)
  })
})
