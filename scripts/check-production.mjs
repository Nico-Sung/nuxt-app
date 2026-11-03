// @ts-check
/**
 * Contrôle de la production : une liste d'URL critiques, ce qu'on attend de
 * chacune (code HTTP, contenu, en-têtes), et un échec si une seule ne répond
 * pas comme prévu. Uniquement des lectures (GET, pré-vérifications CORS).
 *
 *   npm run check:prod
 *
 * Variables (par défaut : la production actuelle) :
 *   API_URL, PRODUCTION_URL (Vercel, SSR), STATIC_URL (CloudFront, SSG),
 *   EXPECTED_COMMIT (hash court attendu en ligne ; vide = pas de contrôle),
 *   EXTRA_URL (URL critique en plus, attendue en 200).
 * En CI, le tableau des résultats est écrit dans le résumé du run.
 */
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * @typedef {{
 *   status: number,
 *   html?: boolean,
 *   includes?: string[],
 *   json?: (data: any) => string | null,
 *   headers?: Record<string, RegExp>,
 *   location?: string,
 * }} Expectation
 * @typedef {{
 *   group: string,
 *   name: string,
 *   url: string | ((fetchFn: typeof fetch) => Promise<string>),
 *   method?: string,
 *   headers?: Record<string, string>,
 *   expect: Expectation,
 * }} Check
 * @typedef {{ check: Check, url: string, ok: boolean, status: number | null, detail: string, ms: number, attempts: number }} CheckResult
 */

const FR = { 'Accept-Language': 'fr-FR', Accept: 'text/html' }

/** Commit attendu dans un JSON { commit } (si EXPECTED_COMMIT est fourni). */
const commitIs =
  (/** @type {string | undefined} */ expected) => (/** @type {any} */ data) => {
    if (data?.status !== 'ok') return `status = ${JSON.stringify(data?.status)}`
    if (!data?.commit) return 'commit absent'
    if (expected && data.commit !== expected) {
      return `commit ${data.commit}, attendu ${expected}`
    }
    return null
  }

const isArray = (/** @type {any} */ data) =>
  Array.isArray(data) ? null : 'une liste JSON était attendue'

/** Premier fichier /_nuxt/*.js cité par une page. */
async function firstAsset(
  /** @type {string} */ pageUrl,
  /** @type {typeof fetch} */ fetchFn,
) {
  const html = await (await fetchFn(pageUrl)).text()
  const path = /\/_nuxt\/[\w.-]+\.js/.exec(html)?.[0]
  if (!path) throw new Error(`aucun fichier /_nuxt/*.js dans ${pageUrl}`)
  return new URL(path, pageUrl).href
}

/**
 * Les URL critiques de la production.
 * @param {{ api: string, ssr: string, ssg: string, commit?: string, extra?: string }} sites
 * @returns {Check[]}
 */
export function productionChecks({ api, ssr, ssg, commit, extra }) {
  /** @type {(origin: string) => Check} */
  const cors = (origin) => ({
    group: 'API (Lambda)',
    name: `CORS depuis ${new URL(origin).host}`,
    url: `${api}/wishlist`,
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    expect: {
      status: 204,
      headers: { 'access-control-allow-origin': new RegExp(`^${origin}$`) },
    },
  })

  /** @type {Check[]} */
  const checks = [
    // ---- API Hono sur AWS Lambda ----
    {
      group: 'API (Lambda)',
      name: '/health',
      url: `${api}/health`,
      expect: { status: 200, json: commitIs(undefined) },
    },
    {
      group: 'API (Lambda)',
      name: '/wishlist',
      url: `${api}/wishlist`,
      expect: { status: 200, json: isArray },
    },
    {
      group: 'API (Lambda)',
      name: '/likes',
      url: `${api}/likes`,
      expect: { status: 200, json: isArray },
    },
    cors(ssr),
    cors(ssg),

    // ---- Front Nuxt en SSR sur Vercel ----
    {
      group: 'Vercel (SSR)',
      name: '/api/health',
      url: `${ssr}/api/health`,
      expect: { status: 200, json: commitIs(commit) },
    },
    {
      group: 'Vercel (SSR)',
      name: 'accueil',
      url: `${ssr}/`,
      headers: FR,
      expect: {
        status: 200,
        html: true,
        includes: ['<title>Pokémon à capturer</title>'],
      },
    },
    {
      group: 'Vercel (SSR)',
      name: 'fiche rendue par une fonction',
      url: `${ssr}/pokemon/pikachu`,
      headers: FR,
      expect: {
        status: 200,
        html: true,
        includes: ['Pikachu', 'Statik'],
        // cdg1::dub1::… : une fonction (Dublin) a rendu la page
        headers: { 'x-vercel-id': /::[a-z]+\d+::/ },
      },
    },
    {
      group: 'Vercel (SSR)',
      name: 'majuscules → redirection',
      url: `${ssr}/pokemon/PIKACHU`,
      headers: FR,
      expect: { status: 301, location: '/pokemon/pikachu' },
    },
    {
      group: 'Vercel (SSR)',
      name: 'Pokémon inconnu',
      url: `${ssr}/pokemon/inconnu`,
      headers: FR,
      expect: { status: 404, html: true },
    },

    // ---- Site statique (nuxt generate) sur S3 + CloudFront ----
    {
      group: 'CloudFront (SSG)',
      name: '/version.json',
      url: `${ssg}/version.json`,
      expect: { status: 200, json: commitIs(commit) },
    },
    {
      group: 'CloudFront (SSG)',
      name: 'accueil',
      url: `${ssg}/`,
      headers: FR,
      expect: {
        status: 200,
        html: true,
        includes: ['<title>Pokémon à capturer</title>'],
      },
    },
    {
      group: 'CloudFront (SSG)',
      name: 'fiche générée au build',
      url: `${ssg}/pokemon/pikachu`,
      headers: FR,
      expect: {
        status: 200,
        html: true,
        includes: ['Pikachu', 'Statik'],
        // fichier S3 servi par CloudFront, sans serveur
        headers: { server: /AmazonS3/, 'x-cache': /cloudfront/i },
      },
    },
    {
      group: 'CloudFront (SSG)',
      name: 'fichier /_nuxt (cache 1 an)',
      url: (fetchFn) => firstAsset(`${ssg}/`, fetchFn),
      expect: {
        status: 200,
        headers: { 'cache-control': /immutable/ },
      },
    },
    {
      group: 'CloudFront (SSG)',
      name: 'Pokémon inconnu',
      url: `${ssg}/pokemon/inconnu`,
      headers: FR,
      expect: { status: 404, html: true },
    },
  ]

  if (extra) {
    checks.push({
      group: 'En plus',
      name: 'URL demandée',
      url: extra,
      headers: FR,
      expect: { status: 200 },
    })
  }
  return checks
}

/** Compare une réponse à l'attendu ; renvoie le problème, ou null. */
async function verify(
  /** @type {Response} */ res,
  /** @type {Expectation} */ expect,
) {
  if (res.status !== expect.status) {
    return `HTTP ${res.status}, attendu ${expect.status}`
  }
  if (expect.location !== undefined) {
    const location = res.headers.get('location') ?? ''
    if (new URL(location, res.url).pathname !== expect.location) {
      return `redirige vers ${location || '(rien)'}, attendu ${expect.location}`
    }
  }
  for (const [name, pattern] of Object.entries(expect.headers ?? {})) {
    const value = res.headers.get(name)
    if (!value || !pattern.test(value)) {
      return `en-tête ${name} = ${value ?? '(absent)'}`
    }
  }
  if (expect.html) {
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('text/html')) return `content-type ${type}`
  }
  if (expect.includes?.length) {
    const body = await res.text()
    const missing = expect.includes.find((text) => !body.includes(text))
    if (missing) return `« ${missing} » absent de la page`
  } else if (expect.json) {
    let data
    try {
      data = await res.json()
    } catch {
      return 'JSON illisible'
    }
    const problem = expect.json(data)
    if (problem) return problem
  }
  return null
}

/**
 * Lance les contrôles (3 essais par URL, 10 s maximum par essai).
 * @param {Check[]} checks
 * @param {{ fetch?: typeof fetch, retries?: number, timeoutMs?: number, delayMs?: number }} [options]
 * @returns {Promise<CheckResult[]>}
 */
export async function runChecks(checks, options = {}) {
  const {
    fetch: fetchFn = fetch,
    retries = 3,
    timeoutMs = 10_000,
    delayMs = 2_000,
  } = options

  return Promise.all(
    checks.map(async (check) => {
      const start = Date.now()
      let url = typeof check.url === 'string' ? check.url : ''
      let status = null
      let detail = ''
      let attempts = 0
      for (; attempts < retries;) {
        attempts++
        try {
          if (typeof check.url === 'function') url = await check.url(fetchFn)
          const res = await fetchFn(url, {
            method: check.method ?? 'GET',
            headers: check.headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
          })
          status = res.status
          const problem = await verify(res, check.expect)
          if (!problem) {
            return {
              check,
              url,
              ok: true,
              status,
              detail: '',
              ms: Date.now() - start,
              attempts,
            }
          }
          detail = problem
        } catch (error) {
          status = null
          detail =
            error instanceof Error && error.name === 'TimeoutError'
              ? `pas de réponse en ${timeoutMs / 1000} s`
              : `injoignable (${error instanceof Error ? error.message : error})`
        }
        if (attempts < retries) await new Promise((r) => setTimeout(r, delayMs))
      }
      return {
        check,
        url,
        ok: false,
        status,
        detail,
        ms: Date.now() - start,
        attempts,
      }
    }),
  )
}

/** Tableau Markdown (résumé du run GitHub). */
export function summaryMarkdown(/** @type {CheckResult[]} */ results) {
  const failed = results.filter((r) => !r.ok).length
  const lines = [
    `## Contrôle de la production : ${failed ? `❌ ${failed} échec(s)` : '✅ tout répond'}`,
    '',
    '| | Cible | Contrôle | HTTP | Attendu | Durée | Détail |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.ok ? '✅' : '❌'} | ${r.check.group} | [${r.check.name}](${r.url}) | ${r.status ?? '—'} | ${r.check.expect.status} | ${r.ms} ms | ${r.ok ? (r.attempts > 1 ? `ok au ${r.attempts}e essai` : '') : r.detail} |`,
    ),
  ]
  return `${lines.join('\n')}\n`
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const env = process.env
  const sites = {
    api:
      env.API_URL || 'https://ff0xn5qhni.execute-api.eu-west-1.amazonaws.com',
    ssr: env.PRODUCTION_URL || 'https://pokemon-a-capturer.vercel.app',
    ssg: env.STATIC_URL || 'https://dmw3t5lkpaeli.cloudfront.net',
    // hash court (7 caractères), comme renvoyé par /health et /version.json
    commit: env.EXPECTED_COMMIT ? env.EXPECTED_COMMIT.slice(0, 7) : undefined,
    extra: env.EXTRA_URL || undefined,
  }
  const results = await runChecks(productionChecks(sites))
  for (const r of results) {
    process.stdout.write(
      `${r.ok ? '✓' : '✗'} ${r.check.group.padEnd(17)} ${r.check.name.padEnd(30)} ${String(r.status ?? '—').padStart(3)} ${String(r.ms).padStart(5)} ms  ${r.ok ? '' : r.detail}\n`,
    )
  }
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, summaryMarkdown(results))
  }
  const failed = results.filter((r) => !r.ok).length
  process.stdout.write(
    failed
      ? `\n✗ ${failed} URL critique(s) en échec.\n`
      : `\n✓ ${results.length} URL critiques conformes.\n`,
  )
  process.exitCode = failed ? 1 : 0
}
