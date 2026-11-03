import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  productionChecks,
  runChecks,
  summaryMarkdown,
} from '../scripts/check-production.mjs'

// fetch réel, capturé avant le garde-fou « zéro réseau » de test/setup.ts
const realFetch = globalThis.fetch

/** Faux site : chaque test règle la réponse d'un chemin. */
type Reply = {
  status: number
  headers?: Record<string, string>
  body?: string
  delayMs?: number
}
let routes: Record<string, Reply | Reply[]> = {}
let server: Server
let base: string

beforeAll(async () => {
  server = createServer((req, res) => {
    const key = `${req.method} ${req.url}`
    const entry = routes[key] ??
      routes[req.url ?? ''] ?? { status: 404, body: 'non' }
    const reply = Array.isArray(entry)
      ? (entry.shift() ?? { status: 500 })
      : entry
    setTimeout(() => {
      res.writeHead(reply.status, reply.headers)
      res.end(reply.body ?? '')
    }, reply.delayMs ?? 0)
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

const json = (data: unknown): Reply => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
})
const html = (
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Reply => ({
  status,
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  body,
})

/** Production entièrement conforme (même origine pour les trois sites). */
function healthyProduction() {
  const page =
    '<title>Pokémon à capturer</title><script src="/_nuxt/entry.abc.js"></script> Pikachu Statik'
  routes = {
    '/health': json({ status: 'ok', commit: 'abc1234' }),
    '/wishlist': json([]),
    '/likes': json([]),
    'OPTIONS /wishlist': {
      status: 204,
      headers: { 'access-control-allow-origin': base },
    },
    '/api/health': json({ status: 'ok', commit: 'abc1234' }),
    '/version.json': json({ status: 'ok', commit: 'abc1234' }),
    '/': html(200, page),
    '/pokemon/pikachu': html(200, page, {
      'x-vercel-id': 'cdg1::dub1::xyz',
      server: 'AmazonS3',
      'x-cache': 'Hit from cloudfront',
    }),
    '/pokemon/PIKACHU': {
      status: 301,
      headers: { location: '/pokemon/pikachu' },
    },
    '/pokemon/inconnu': html(404, 'Pokémon introuvable'),
    '/_nuxt/entry.abc.js': {
      status: 200,
      headers: { 'cache-control': 'public,max-age=31536000,immutable' },
    },
  }
}

const check = (extra: Partial<Parameters<typeof productionChecks>[0]> = {}) =>
  runChecks(
    productionChecks({
      api: base,
      ssr: base,
      ssg: base,
      commit: 'abc1234',
      ...extra,
    }),
    { fetch: realFetch, retries: 2, timeoutMs: 500, delayMs: 0 },
  )

const failures = (results: Awaited<ReturnType<typeof check>>) =>
  results
    .filter((r) => !r.ok)
    .map((r) => `${r.check.group} ${r.check.name} : ${r.detail}`)

describe('contrôle de la production', () => {
  it('tout est conforme : 15 contrôles, aucun échec', async () => {
    healthyProduction()
    const results = await check()
    expect(results).toHaveLength(15)
    expect(failures(results)).toEqual([])
  })

  it('/health en 500 : échec, avec le code obtenu', async () => {
    healthyProduction()
    routes['/health'] = { status: 500, body: 'boom' }
    const failed = failures(await check())
    expect(failed).toEqual(['API (Lambda) /health : HTTP 500, attendu 200'])
  })

  it('page qui devrait être 404 mais répond 200 : échec', async () => {
    healthyProduction()
    routes['/pokemon/inconnu'] = html(200, 'oups')
    expect(failures(await check())).toContain(
      'Vercel (SSR) Pokémon inconnu : HTTP 200, attendu 404',
    )
  })

  it('mauvais commit en ligne : échec', async () => {
    healthyProduction()
    expect(failures(await check({ commit: 'fff0000' }))).toContain(
      'Vercel (SSR) /api/health : commit abc1234, attendu fff0000',
    )
  })

  it('pas de réponse dans le délai : échec', async () => {
    healthyProduction()
    routes['/likes'] = { ...json([]), delayMs: 1500 }
    expect(failures(await check())).toContain(
      'API (Lambda) /likes : pas de réponse en 0.5 s',
    )
  })

  it('fiche SSR servie sans fonction, ou SSG sans S3 : échec', async () => {
    healthyProduction()
    routes['/pokemon/pikachu'] = html(200, 'Pikachu Statik')
    const failed = failures(await check())
    expect(failed).toContain(
      'Vercel (SSR) fiche rendue par une fonction : en-tête x-vercel-id = (absent)',
    )
    expect(failed).toContain(
      'CloudFront (SSG) fiche générée au build : en-tête server = (absent)',
    )
  })

  it('erreur passagère puis succès : conforme grâce au 2e essai', async () => {
    healthyProduction()
    routes['/wishlist'] = [{ status: 503 }, json([])]
    const results = await check()
    expect(failures(results)).toEqual([])
    expect(results.find((r) => r.check.name === '/wishlist')?.attempts).toBe(2)
  })

  it('URL critique en plus qui n’existe pas : échec', async () => {
    healthyProduction()
    expect(failures(await check({ extra: `${base}/n-existe-pas` }))).toEqual([
      'En plus URL demandée : HTTP 404, attendu 200',
    ])
  })

  it('résumé : un tableau Markdown avec ✅ et ❌', async () => {
    healthyProduction()
    routes['/health'] = { status: 500 }
    const markdown = summaryMarkdown(await check())
    expect(markdown).toContain('❌ 1 échec(s)')
    expect(markdown).toContain('| ❌ | API (Lambda) | [/health]')
    expect(markdown).toContain('| ✅ | CloudFront (SSG) |')
  })
})
