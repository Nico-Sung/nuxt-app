// @ts-check
/**
 * Couverture Vitest (coverage/coverage-summary.json) -> badge SVG + rapport
 * Markdown. Sans service extérieur : le badge est une image générée ici.
 *
 *   node scripts/coverage-report.mjs --summary coverage/coverage-summary.json \
 *     --name front --label "front (logique TS)" --out coverage-badge
 *
 * Écrit <out>/coverage-<name>.svg et <out>/coverage-<name>.md ; en CI, ajoute
 * aussi le rapport au résumé du run.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

/** @typedef {{ total: number, covered: number, pct: number | 'Unknown' }} Metric */
/** @typedef {Record<'lines' | 'statements' | 'functions' | 'branches', Metric>} Metrics */

const pct = (/** @type {Metric} */ m) =>
  typeof m.pct === 'number' ? m.pct : 100

/** Taux affiché : « 90,8 % ». */
export const formatPct = (/** @type {number} */ value) =>
  `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`

/** Couleur du badge selon le taux (mêmes paliers que shields.io). */
export function badgeColor(/** @type {number} */ value) {
  if (value >= 90) return '#4c1'
  if (value >= 80) return '#97ca00'
  if (value >= 70) return '#a4a61d'
  if (value >= 60) return '#dfb317'
  if (value >= 50) return '#fe7d37'
  return '#e05d44'
}

const escapeXml = (/** @type {string} */ text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Largeur approximative d'un texte en Verdana 11px. */
const textWidth = (/** @type {string} */ text) =>
  Math.round(text.length * 6.6) + 10

/** Badge « label | 90,8 % » au style shields.io (plat). */
export function badgeSvg(
  /** @type {string} */ label,
  /** @type {number} */ value,
) {
  const right = formatPct(value)
  const lw = textWidth(label)
  const rw = textWidth(right)
  const w = lw + rw
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(`${label}: ${right}`)}">
  <title>${escapeXml(`${label}: ${right}`)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${badgeColor(value)}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${escapeXml(label)}</text>
    <text x="${lw + rw / 2}" y="14">${escapeXml(right)}</text>
  </g>
</svg>
`
}

const cell = (/** @type {Metric} */ m) =>
  `${formatPct(pct(m))} (${m.covered}/${m.total})`

/**
 * Rapport Markdown : totaux, puis les fichiers les moins couverts.
 * @param {string} label
 * @param {Record<string, Metrics>} summary contenu de coverage-summary.json
 * @param {string} root dossier de référence pour les chemins affichés
 */
export function reportMarkdown(label, summary, root, limit = 10) {
  const { total, ...files } = summary
  if (!total) throw new Error('coverage-summary.json sans "total"')
  const rows = Object.entries(files)
    .map(([file, m]) => ({ file: relative(root, file) || file, m }))
    .sort(
      (a, b) => pct(a.m.lines) - pct(b.m.lines) || a.file.localeCompare(b.file),
    )
  return [
    `### Couverture ${label} : ${formatPct(pct(total.lines))} des lignes`,
    '',
    '| | Lignes | Instructions | Fonctions | Branches |',
    '|---|---|---|---|---|',
    `| **Total** | ${cell(total.lines)} | ${cell(total.statements)} | ${cell(total.functions)} | ${cell(total.branches)} |`,
    '',
    `<details><summary>Les ${Math.min(limit, rows.length)} fichiers les moins couverts (sur ${rows.length})</summary>`,
    '',
    '| Fichier | Lignes | Branches |',
    '|---|---|---|',
    ...rows
      .slice(0, limit)
      .map(
        ({ file, m }) =>
          `| \`${file}\` | ${cell(m.lines)} | ${cell(m.branches)} |`,
      ),
    '',
    '</details>',
    '',
  ].join('\n')
}

/** --cle valeur -> { cle: valeur } */
function parseArgs(/** @type {string[]} */ argv) {
  /** @type {Record<string, string>} */
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '')
    if (key) args[key] = argv[i + 1] ?? ''
  }
  return args
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const {
    summary: file = 'coverage/coverage-summary.json',
    name,
    label,
    out = '.',
  } = parseArgs(process.argv.slice(2))
  if (!name || !label) {
    process.stderr.write(
      'Usage : --summary <json> --name <nom> --label <libellé> --out <dossier>\n',
    )
    process.exit(2)
  }
  const summary = JSON.parse(readFileSync(file, 'utf8'))
  const value = pct(summary.total.lines)
  const markdown = reportMarkdown(label, summary, process.cwd())

  mkdirSync(out, { recursive: true })
  writeFileSync(
    join(out, `coverage-${name}.svg`),
    badgeSvg(`coverage ${label}`, value),
  )
  writeFileSync(join(out, `coverage-${name}.md`), markdown)
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)
  process.stdout.write(`Couverture ${label} : ${formatPct(value)} des lignes\n`)
}
