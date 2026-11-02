import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { app, createApp, type HealthResponse } from '../src/app.js'
import { shortSha, VERSION } from '../src/version.js'

const pkg = createRequire(import.meta.url)('../package.json') as {
  version: string
}

describe('GET /health', () => {
  it('répond 200 avec le statut, la version et le commit', async () => {
    const res = await createApp({
      version: '1.2.3',
      commit: 'abc1234',
    }).request('/health')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual<HealthResponse>({
      status: 'ok',
      version: '1.2.3',
      commit: 'abc1234',
    })
  })

  it('expose la version de package.json', async () => {
    const res = await app.request('/health')
    const body = (await res.json()) as HealthResponse

    expect(res.status).toBe(200)
    expect(body.version).toBe(pkg.version)
    expect(VERSION).toBe(pkg.version)
  })
})

describe('routes inconnues', () => {
  it('répondent 404 en JSON', async () => {
    const res = await app.request('/nope')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not Found' })
  })
})

describe('shortSha', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('garde les 7 premiers caractères du hash', () => {
    expect(shortSha('9241f4c8d2e1a0b7c6d5e4f3a2b1c0d9e8f7a6b5')).toBe('9241f4c')
  })

  it('vaut "dev" sans GIT_SHA', () => {
    expect(shortSha(undefined)).toBe('dev')
    expect(shortSha('  ')).toBe('dev')
  })

  it('lit GIT_SHA au chargement de l’app', async () => {
    vi.stubEnv('GIT_SHA', 'deadbeefcafe')
    vi.resetModules()
    const { app: freshApp } = await import('../src/app.js')

    const body = (await (
      await freshApp.request('/health')
    ).json()) as HealthResponse
    expect(body.commit).toBe('deadbee')
  })
})
