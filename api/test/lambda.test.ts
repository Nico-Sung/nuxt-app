import { GetParameterCommand } from '@aws-sdk/client-ssm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseOrigins } from '../src/app.js'

/** Événement API Gateway HTTP API (payload v2), tel que reçu par la Lambda. */
function apiGatewayEvent(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'abc.execute-api.eu-west-1.amazonaws.com', ...headers },
    requestContext: {
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '1.2.3.4',
        userAgent: 'vitest',
      },
      domainName: 'abc.execute-api.eu-west-1.amazonaws.com',
      requestId: 'test',
      routeKey: '$default',
      stage: '$default',
      timeEpoch: 0,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
  }
}

/** Le handler lit l'environnement au premier appel : module neuf à chaque test. */
async function loadHandler(env: Record<string, string>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  return (await import('../src/lambda.js')).handler
}

const ENV = {
  APP_VERSION: '9.9.9',
  GIT_SHA: 'abcdef1234567',
  CORS_ORIGIN: 'http://localhost:3000, http://localhost:3200',
  DATABASE_URL: '',
  DATABASE_URL_PARAMETER: '',
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('handler Lambda (API Gateway v2)', () => {
  it('GET /health : 200 avec la version et le commit du déploiement', async () => {
    const handler = await loadHandler(ENV)
    const res = await handler(apiGatewayEvent('GET', '/health') as never)

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      status: 'ok',
      version: '9.9.9',
      commit: 'abcdef1',
    })
  })

  it('GET /wishlist : 200 (liste en mémoire sans base configurée)', async () => {
    const handler = await loadHandler(ENV)
    const res = await handler(apiGatewayEvent('GET', '/wishlist') as never)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('POST puis GET : le body JSON de l’événement est lu', async () => {
    const handler = await loadHandler(ENV)
    const pikachu = { id: 25, name: 'Pikachu', sprite: '25.png' }
    const created = await handler(
      apiGatewayEvent(
        'POST',
        '/wishlist',
        { 'content-type': 'application/json' },
        pikachu,
      ) as never,
    )
    expect(created.statusCode).toBe(201)

    // même instance : même liste
    const list = await handler(apiGatewayEvent('GET', '/wishlist') as never)
    expect(JSON.parse(list.body)).toMatchObject([{ pokemon: pikachu }])
  })

  it.each(['http://localhost:3000', 'http://localhost:3200'])(
    'CORS : pré-vérification acceptée depuis %s',
    async (origin) => {
      const handler = await loadHandler(ENV)
      const res = await handler(
        apiGatewayEvent('OPTIONS', '/wishlist', {
          origin,
          'access-control-request-method': 'POST',
        }) as never,
      )
      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe(origin)
    },
  )

  it('CORS : autre origine refusée (aucun en-tête Allow-Origin)', async () => {
    const handler = await loadHandler(ENV)
    const res = await handler(
      apiGatewayEvent('OPTIONS', '/wishlist', {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
      }) as never,
    )
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('messages traduits via Accept-Language', async () => {
    const handler = await loadHandler(ENV)
    const res = await handler(
      apiGatewayEvent('DELETE', '/wishlist/9', {
        'accept-language': 'fr',
      }) as never,
    )
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body).error).toBe('Pokémon absent de la liste')
  })
})

describe('resolveDatabaseUrl', () => {
  const ssm = (value?: string) => ({
    send: vi.fn(async () => ({
      Parameter: value ? { Value: value } : undefined,
    })),
  })

  async function resolve() {
    vi.resetModules()
    return (await import('../src/lambda.js')).resolveDatabaseUrl
  }

  it('lit le paramètre SSM, déchiffré', async () => {
    const resolveDatabaseUrl = await resolve()
    const client = ssm('postgresql://user:secret@host:6543/postgres')

    await expect(
      resolveDatabaseUrl(
        { DATABASE_URL_PARAMETER: '/pokemon-api/database-url' },
        client as never,
      ),
    ).resolves.toBe('postgresql://user:secret@host:6543/postgres')

    const [command] = client.send.mock.calls[0] as unknown as [
      GetParameterCommand,
    ]
    expect(command).toBeInstanceOf(GetParameterCommand)
    expect(command.input).toEqual({
      Name: '/pokemon-api/database-url',
      WithDecryption: true,
    })
  })

  it('DATABASE_URL directe : SSM n’est pas appelé', async () => {
    const resolveDatabaseUrl = await resolve()
    const client = ssm('ignoré')
    await expect(
      resolveDatabaseUrl(
        { DATABASE_URL: 'postgres://direct' },
        client as never,
      ),
    ).resolves.toBe('postgres://direct')
    expect(client.send).not.toHaveBeenCalled()
  })

  it('rien de configuré : undefined (liste en mémoire)', async () => {
    const resolveDatabaseUrl = await resolve()
    await expect(
      resolveDatabaseUrl({}, ssm() as never),
    ).resolves.toBeUndefined()
  })

  it('paramètre vide : erreur explicite', async () => {
    const resolveDatabaseUrl = await resolve()
    await expect(
      resolveDatabaseUrl({ DATABASE_URL_PARAMETER: '/vide' }, ssm() as never),
    ).rejects.toThrow('Paramètre SSM vide : /vide')
  })
})

describe('parseOrigins', () => {
  it('sépare les origines par des virgules', () => {
    expect(parseOrigins('http://a, http://b,,  ')).toEqual([
      'http://a',
      'http://b',
    ])
    expect(parseOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
    ])
  })
})
