// @ts-check
/**
 * Compare les fiches Pokémon servies en SSR (Vercel) et en SSG (CloudFront),
 * telles qu'un client sans JavaScript les reçoit : HTML brut par HTTP.
 *
 *   npm run compare:ssr-ssg
 *
 * Pour chaque fiche et chaque site : bon <title>, vrai contenu visible (pas
 * une coquille vide), et mêmes informations des deux côtés. Les <script> sont
 * retirés avant l'analyse : les données de Nuxt (__NUXT_DATA__) y sont même
 * quand la page n'affiche rien.
 *
 * Variables : PRODUCTION_URL (SSR), STATIC_URL (SSG). Résumé du run en CI.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const NAMES = JSON.parse(
  readFileSync(
    new URL('../shared/data/pokemon-names.json', import.meta.url),
    'utf8',
  ),
)

/** Fiches comparées : cas simples et cas particuliers (accents, points, formes). */
export const POKEMON = [
  { id: 1, slug: 'bulbasaur' },
  { id: 25, slug: 'pikachu' },
  { id: 122, slug: 'mr-mime' }, // « M. Mime »
  { id: 133, slug: 'eevee' }, // « Évoli »
  { id: 386, slug: 'deoxys-normal' }, // forme par défaut
  { id: 1025, slug: 'pecharunt' }, // dernier, description en anglais seulement
]

/** Moins de texte visible que ça : coquille vide. */
export const MIN_VISIBLE_TEXT = 200

const decode = (/** @type {string} */ text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const clean = (/** @type {string} */ html) =>
  decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

/** Contenu d'un élément repéré par sa classe ou sa balise (premier trouvé). */
function pick(/** @type {string} */ html, /** @type {RegExp} */ pattern) {
  const match = pattern.exec(html)
  return match?.[1] !== undefined ? clean(match[1]) : null
}

/**
 * Ce qu'un client sans JavaScript lit dans la page.
 * @param {string} html
 */
export function readPage(html) {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(withoutScripts)?.[1] ?? ''
  return {
    lang: /<html[^>]*\blang="([^"]*)"/i.exec(html)?.[1] ?? null,
    title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: pick(body, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    number: pick(body, /class="num"[^>]*>([\s\S]*?)</i),
    genus: pick(body, /class="genus"[^>]*>([\s\S]*?)</i),
    description: pick(body, /class="description"[^>]*>([\s\S]*?)<\/p>/i),
    types: [...body.matchAll(/class="type"[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
      clean(m[1] ?? ''),
    ),
    abilities: [
      ...(
        /class="abilities"[^>]*>([\s\S]*?)<\/ul>/i.exec(body)?.[1] ?? ''
      ).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
    ].map((m) => clean(m[1] ?? '')),
    total: pick(body, /Total<\/dt>\s*<dd[^>]*>\s*<span[^>]*>(\d+)</i),
    visibleText: clean(body).length,
  }
}

/** @typedef {ReturnType<typeof readPage>} Page */

/** Fields comparés entre SSR et SSG (ce que l'utilisateur voit). */
const COMPARED = /** @type {const} */ ([
  'title',
  'h1',
  'number',
  'genus',
  'description',
  'types',
  'abilities',
  'total',
])

/**
 * Problèmes d'une page : titre, coquille vide, informations manquantes.
 * @param {Page} page
 * @param {{ id: number }} pokemon
 */
export function pageProblems(page, pokemon) {
  /** @type {string[]} */
  const problems = []
  const name = NAMES.species[String(pokemon.id)]?.fr
  const expectedTitle = `${name} · Pokémon à capturer`
  if (page.visibleText < MIN_VISIBLE_TEXT) {
    problems.push(`coquille vide : ${page.visibleText} caractères visibles`)
  }
  if (page.title !== expectedTitle) {
    problems.push(
      `title « ${page.title ?? '(absent)'} », attendu « ${expectedTitle} »`,
    )
  }
  if (page.h1 !== name) problems.push(`h1 « ${page.h1 ?? '(absent)'} »`)
  if (page.lang !== 'fr') problems.push(`lang="${page.lang ?? ''}"`)
  if (page.number !== `#${String(pokemon.id).padStart(3, '0')}`) {
    problems.push(`numéro ${page.number ?? '(absent)'}`)
  }
  if (!page.types.length) problems.push('aucun type')
  if (!page.abilities.length) problems.push('aucun talent')
  if (!page.total) problems.push('pas de total des stats')
  if (!page.description) problems.push('pas de description')
  return problems
}

/** Différences SSR / SSG. */
export function differences(/** @type {Page} */ ssr, /** @type {Page} */ ssg) {
  return COMPARED.filter(
    (field) => JSON.stringify(ssr[field]) !== JSON.stringify(ssg[field]),
  ).map(
    (field) =>
      `${field} : SSR ${JSON.stringify(ssr[field])} ≠ SSG ${JSON.stringify(ssg[field])}`,
  )
}

/**
 * Récupère et analyse chaque fiche sur les deux sites.
 * @param {{ ssr: string, ssg: string, fetch?: typeof fetch, pokemon?: typeof POKEMON }} options
 */
export async function compare({
  ssr,
  ssg,
  fetch: fetchFn = fetch,
  pokemon = POKEMON,
}) {
  const get = async (/** @type {string} */ url) => {
    const res = await fetchFn(url, {
      // un client sans JavaScript, en français
      headers: { Accept: 'text/html', 'Accept-Language': 'fr-FR' },
      signal: AbortSignal.timeout(15_000),
    })
    const html = await res.text()
    return { status: res.status, bytes: html.length, page: readPage(html) }
  }

  return Promise.all(
    pokemon.map(async (p) => {
      const [a, b] = await Promise.all([
        get(`${ssr}/pokemon/${p.slug}`),
        get(`${ssg}/pokemon/${p.slug}`),
      ])
      const problems = [
        ...(a.status === 200 ? [] : [`SSR : HTTP ${a.status}`]),
        ...(b.status === 200 ? [] : [`SSG : HTTP ${b.status}`]),
        ...pageProblems(a.page, p).map((x) => `SSR : ${x}`),
        ...pageProblems(b.page, p).map((x) => `SSG : ${x}`),
        ...differences(a.page, b.page),
      ]
      return { pokemon: p, ssr: a, ssg: b, problems }
    }),
  )
}

/** @typedef {Awaited<ReturnType<typeof compare>>[number]} Comparison */

export function summaryMarkdown(/** @type {Comparison[]} */ results) {
  const failed = results.filter((r) => r.problems.length).length
  return [
    `## SSR (Vercel) et SSG (CloudFront) sans JavaScript : ${failed ? `❌ ${failed} fiche(s)` : '✅ identiques, pas de coquille vide'}`,
    '',
    '| | Fiche | title | Texte visible SSR / SSG | HTML SSR / SSG | Total | Problèmes |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.problems.length ? '❌' : '✅'} | /pokemon/${r.pokemon.slug} | ${r.ssr.page.title ?? '—'} | ${r.ssr.page.visibleText} / ${r.ssg.page.visibleText} car. | ${Math.round(r.ssr.bytes / 1024)} / ${Math.round(r.ssg.bytes / 1024)} Ko | ${r.ssr.page.total ?? '—'} | ${r.problems.join(' ; ')} |`,
    ),
    '',
  ].join('\n')
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const results = await compare({
    ssr: process.env.PRODUCTION_URL || 'https://pokemon-a-capturer.vercel.app',
    ssg: process.env.STATIC_URL || 'https://dmw3t5lkpaeli.cloudfront.net',
  })
  for (const r of results) {
    const { page } = r.ssr
    process.stdout.write(
      `${r.problems.length ? '✗' : '✓'} ${`/pokemon/${r.pokemon.slug}`.padEnd(24)} « ${page.title} » · ${page.visibleText}/${r.ssg.page.visibleText} car. visibles · ${page.abilities.join(', ')} · total ${page.total}\n`,
    )
    for (const problem of r.problems) process.stdout.write(`    - ${problem}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(results))
  }
  const failed = results.filter((r) => r.problems.length).length
  process.stdout.write(
    failed
      ? `\n✗ ${failed} fiche(s) en échec.\n`
      : `\n✓ ${results.length} fiches : vrai contenu, identiques en SSR et SSG.\n`,
  )
  process.exitCode = failed ? 1 : 0
}
