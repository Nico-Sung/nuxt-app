// @ts-check
/**
 * Vérifie les fichiers de langue : dans chaque dossier donné, chaque *.json
 * est comparé à en.json (la référence).
 *
 *   node scripts/check-locales.mjs i18n/locales api/locales
 *
 * Échoue (code 1) si un fichier a une clé manquante ou en trop, un type
 * différent (texte / groupe), des variables {x} différentes, un texte vide
 * ou un JSON invalide. Sans dépendance : tourne sans `npm ci`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const REFERENCE = 'en.json'

/**
 * @typedef {{ [key: string]: Messages | string }} Messages
 * @typedef {'missing' | 'extra' | 'type' | 'placeholders' | 'empty' | 'invalid'} ProblemKind
 * @typedef {{ kind: ProblemKind, key: string, detail?: string }} Problem
 * @typedef {{ file: string, keys: number, problems: Problem[] }} FileReport
 */

/** @param {unknown} value @returns {value is Messages} */
const isGroup = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Variables d'un message : "Retirer {name}" -> ["name"]. */
export function placeholders(/** @type {string} */ message) {
  return [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
    .filter((name) => name !== undefined)
    .sort()
}

/** Chemins des textes d'un groupe : { a: { b: 'x' } } -> ["a.b"]. */
export function leafKeys(/** @type {Messages} */ messages, prefix = '') {
  /** @type {string[]} */
  const keys = []
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix + key
    if (isGroup(value)) keys.push(...leafKeys(value, `${path}.`))
    else keys.push(path)
  }
  return keys
}

/**
 * Compare un fichier de langue à la référence.
 * @param {Messages} reference
 * @param {Messages} messages
 * @returns {Problem[]}
 */
export function compareMessages(reference, messages, prefix = '') {
  /** @type {Problem[]} */
  const problems = []

  for (const [key, refValue] of Object.entries(reference)) {
    const path = prefix + key
    const value = messages[key]

    if (!(key in messages)) {
      const missing = isGroup(refValue)
        ? leafKeys(refValue, `${path}.`)
        : [path]
      for (const k of missing) problems.push({ kind: 'missing', key: k })
    } else if (isGroup(refValue) !== isGroup(value)) {
      problems.push({
        kind: 'type',
        key: path,
        detail: isGroup(refValue)
          ? 'groupe de clés attendu, texte trouvé'
          : 'texte attendu, groupe de clés trouvé',
      })
    } else if (isGroup(refValue) && isGroup(value)) {
      problems.push(...compareMessages(refValue, value, `${path}.`))
    } else if (typeof value !== 'string') {
      problems.push({
        kind: 'invalid',
        key: path,
        detail: `texte attendu, ${JSON.stringify(value)} trouvé`,
      })
    } else if (value.trim() === '') {
      problems.push({ kind: 'empty', key: path })
    } else if (typeof refValue === 'string') {
      const expected = placeholders(refValue)
      const actual = placeholders(value)
      if (expected.join() !== actual.join()) {
        problems.push({
          kind: 'placeholders',
          key: path,
          detail: `attendu {${expected.join('}, {')}}, trouvé {${actual.join('}, {')}}`,
        })
      }
    }
  }

  for (const [key, value] of Object.entries(messages)) {
    if (key in reference) continue
    const path = prefix + key
    const extra = isGroup(value) ? leafKeys(value, `${path}.`) : [path]
    for (const k of extra) problems.push({ kind: 'extra', key: k })
  }

  return problems
}

/** La référence elle-même : textes non vides, rien d'autre que textes et groupes. */
export function checkReference(/** @type {Messages} */ reference, prefix = '') {
  /** @type {Problem[]} */
  const problems = []
  for (const [key, value] of Object.entries(reference)) {
    const path = prefix + key
    if (isGroup(value)) problems.push(...checkReference(value, `${path}.`))
    else if (typeof value !== 'string') {
      problems.push({
        kind: 'invalid',
        key: path,
        detail: `texte attendu, ${JSON.stringify(value)} trouvé`,
      })
    } else if (value.trim() === '') problems.push({ kind: 'empty', key: path })
  }
  return problems
}

/** @param {string} path @returns {{ messages?: Messages, error?: string }} */
function readMessages(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    if (!isGroup(data)) return { error: 'le fichier doit contenir un objet' }
    return { messages: data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Vérifie un dossier de langues : en.json + chaque autre *.json.
 * @param {string} dir
 * @returns {FileReport[]}
 */
export function checkDirectory(dir) {
  const referencePath = join(dir, REFERENCE)
  if (!existsSync(referencePath)) {
    return [
      {
        file: referencePath,
        keys: 0,
        problems: [
          { kind: 'invalid', key: '', detail: 'fichier de référence absent' },
        ],
      },
    ]
  }

  const ref = readMessages(referencePath)
  if (!ref.messages) {
    return [
      {
        file: referencePath,
        keys: 0,
        problems: [
          { kind: 'invalid', key: '', detail: `JSON invalide : ${ref.error}` },
        ],
      },
    ]
  }

  /** @type {FileReport[]} */
  const reports = [
    {
      file: referencePath,
      keys: leafKeys(ref.messages).length,
      problems: checkReference(ref.messages),
    },
  ]

  const others = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== REFERENCE)
    .sort()

  for (const name of others) {
    const file = join(dir, name)
    const locale = readMessages(file)
    reports.push(
      locale.messages
        ? {
            file,
            keys: leafKeys(locale.messages).length,
            problems: compareMessages(ref.messages, locale.messages),
          }
        : {
            file,
            keys: 0,
            problems: [
              {
                kind: 'invalid',
                key: '',
                detail: `JSON invalide : ${locale.error}`,
              },
            ],
          },
    )
  }
  return reports
}

/** @type {Record<ProblemKind, string>} */
const LABELS = {
  missing: 'clé manquante',
  extra: 'clé en trop (absente de en.json)',
  type: 'type différent',
  placeholders: 'variables différentes',
  empty: 'texte vide',
  invalid: 'invalide',
}

/** @param {Problem} problem */
export function describe(problem) {
  const parts = [LABELS[problem.kind]]
  if (problem.key) parts.push(problem.key)
  const text = parts.join(' : ')
  return problem.detail ? `${text} (${problem.detail})` : text
}

/**
 * Vérifie les dossiers et affiche le rapport ; renvoie le nombre de problèmes.
 * @param {string[]} dirs
 * @param {(line: string) => void} print
 */
export function run(dirs, print = (line) => process.stdout.write(`${line}\n`)) {
  let total = 0
  const github = process.env.GITHUB_ACTIONS === 'true'

  for (const dir of dirs) {
    print(`\n${dir}`)
    for (const report of checkDirectory(dir)) {
      const name = report.file.slice(dir.length + 1) || report.file
      if (!report.problems.length) {
        print(`  ✓ ${name} : ${report.keys} clés`)
        continue
      }
      total += report.problems.length
      print(`  ✗ ${name} : ${report.problems.length} problème(s)`)
      for (const problem of report.problems) {
        print(`      - ${describe(problem)}`)
        // Annotation visible dans le résumé du run GitHub Actions.
        if (github) print(`::error file=${report.file}::${describe(problem)}`)
      }
    }
  }

  print(
    total
      ? `\n✗ ${total} problème(s) dans les fichiers de langue.`
      : `\n✓ Toutes les langues ont les mêmes clés que ${REFERENCE}.`,
  )
  return total
}

// Exécuté directement (pas importé par un test).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const dirs = process.argv.slice(2)
  if (!dirs.length) {
    process.stderr.write(
      'Usage : node scripts/check-locales.mjs <dossier> [dossier…]\n',
    )
    process.exit(2)
  }
  process.exitCode = run(dirs) ? 1 : 0
}
