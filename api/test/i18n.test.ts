import { describe, expect, it } from 'vitest'
import { createApp, type ErrorCode, type ErrorResponse } from '../src/app.js'
import { translate } from '../src/i18n.js'
import en from '../locales/en.json' with { type: 'json' }
import fr from '../locales/fr.json' with { type: 'json' }

const ERROR_CODES: ErrorCode[] = [
  'invalid_body',
  'duplicate',
  'full',
  'invalid_id',
  'not_found',
  'route_not_found',
  'internal_error',
]

const app = () => createApp({ version: 'test', commit: 'test' })

/** DELETE d'un Pokémon absent -> 404 not_found, dans la langue demandée. */
const notFound = (headers: Record<string, string> = {}) =>
  app().request('/wishlist/999', { method: 'DELETE', headers })

describe('messages d’erreur traduits (Accept-Language)', () => {
  it('anglais par défaut, sans en-tête', async () => {
    const res = await notFound()
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Language')).toBe('en')
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'Pokémon not in the list',
      code: 'not_found',
    })
  })

  it.each(['fr', 'fr-FR', 'FR', 'de-DE,fr;q=0.8,en;q=0.5'])(
    'français : Accept-Language %j',
    async (header) => {
      const res = await notFound({ 'Accept-Language': header })
      expect(res.headers.get('Content-Language')).toBe('fr')
      expect(await res.json()).toEqual<ErrorResponse>({
        error: 'Pokémon absent de la liste',
        code: 'not_found',
      })
    },
  )

  it.each(['de', 'ja-JP', 'fr;q=0'])(
    'langue non gérée (%j) : anglais',
    async (header) => {
      const res = await notFound({ 'Accept-Language': header })
      expect(res.headers.get('Content-Language')).toBe('en')
      expect(((await res.json()) as ErrorResponse).error).toBe(
        'Pokémon not in the list',
      )
    },
  )

  it('le code reste le même dans toutes les langues', async () => {
    const codes = await Promise.all(
      ['en', 'fr'].map(async (lang) => {
        const res = await notFound({ 'Accept-Language': lang })
        return ((await res.json()) as ErrorResponse).code
      }),
    )
    expect(codes).toEqual(['not_found', 'not_found'])
  })

  it('liste pleine : variable {max} remplacée en français', async () => {
    const api = app()
    for (let id = 1; id <= 6; id++) {
      await api.request('/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: `P${id}`, sprite: '' }),
      })
    }
    const res = await api.request('/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'fr' },
      body: JSON.stringify({ id: 7, name: 'P7', sprite: '' }),
    })
    expect(await res.json()).toEqual<ErrorResponse>({
      error: 'Liste pleine (6 max)',
      code: 'full',
    })
  })

  it('le CORS autorise l’en-tête Accept-Language', async () => {
    const res = await app().request('/wishlist', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Accept-Language',
      },
    })
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
      'Accept-Language',
    )
  })
})

describe('translate', () => {
  it('chaque code d’erreur a un message en anglais et en français', () => {
    for (const code of ERROR_CODES) {
      expect(en.errors[code], `en: errors.${code}`).toBeTruthy()
      expect(fr.errors[code], `fr: errors.${code}`).toBeTruthy()
    }
  })

  it('clé absente : repli sur l’anglais, puis sur la clé', () => {
    expect(translate('fr', 'errors.duplicate')).toBe(
      'Pokémon déjà dans la liste',
    )
    expect(translate('de', 'errors.duplicate')).toBe(
      'Pokémon already in the list',
    )
    expect(translate('fr', 'errors.inconnue')).toBe('errors.inconnue')
  })

  it('remplace les variables, laisse les inconnues', () => {
    expect(translate('en', 'errors.full', { max: 6 })).toBe('List full (6 max)')
    expect(translate('en', 'errors.full')).toBe('List full ({max} max)')
  })
})
