import { expect, test, type Page } from '@playwright/test'
import { API_URL } from './env'

/**
 * Fiche /pokemon/[name] : rendue par le serveur Nuxt, qui appelle le faux
 * PokéAPI (e2e/fake-pokeapi.mjs). Rien n'est simulé dans le navigateur
 * sauf les images (hébergées sur GitHub).
 */

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const DESCRIPTION =
  'Il lui arrive de remettre sur pied un Pikachu allié en lui envoyant une décharge électrique.'

async function blockImages(page: Page) {
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1PX }),
  )
}

test.beforeEach(async ({ page }) => {
  await blockImages(page)
})

/** Vérifie toutes les informations de la fiche de Pikachu. */
async function expectPikachuProfile(page: Page) {
  await expect(page).toHaveTitle('Pikachu · Pokémon à capturer')

  const profile = page.locator('article.profile')
  await expect(profile.getByRole('heading', { level: 1 })).toHaveText('Pikachu')
  await expect(profile.locator('.num')).toHaveText('#025')
  await expect(profile.locator('.genus')).toHaveText('Pokémon Souris')
  await expect(profile.getByRole('list', { name: 'Types' })).toHaveText(
    'Électrik',
  )
  await expect(profile.locator('.description')).toHaveText(DESCRIPTION)
  await expect(profile.getByRole('img', { name: 'Pikachu' })).toBeVisible()

  const facts = profile.locator('.facts')
  await expect(facts).toContainText('Taille0,4 m')
  await expect(facts).toContainText('Poids6 kg')
  await expect(facts.locator('.abilities li')).toHaveText([
    'Static',
    'Lightning Rod (caché)',
  ])

  const stats = profile.getByRole('region', { name: 'Statistiques de base' })
  await expect(stats.locator('.stat')).toHaveText([
    'PV35',
    'Attaque55',
    'Défense40',
    'Att. Spé.50',
    'Déf. Spé.50',
    'Vitesse90',
    'Total320',
  ])
}

test.describe('fiche Pokémon /pokemon/[name]', () => {
  test('URL directe : affiche le Pokémon et ses informations', async ({
    page,
  }) => {
    const response = await page.goto('/pokemon/pikachu')
    expect(response?.status()).toBe(200)

    await expectPikachuProfile(page)
  })

  test('rendu serveur : le HTML reçu contient déjà la fiche (sans JavaScript)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await blockImages(page)

    const response = await page.goto('/pokemon/pikachu')
    expect(response?.status()).toBe(200)
    await expectPikachuProfile(page)

    await context.close()
  })

  test('404 : Pokémon inconnu', async ({ page }) => {
    const response = await page.goto('/pokemon/inconnu')
    expect(response?.status()).toBe(404)

    await expect(page).toHaveTitle('Pokémon introuvable · Pokémon à capturer')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pokémon introuvable',
    )
    await expect(page.getByText('Erreur 404')).toBeVisible()
    await expect(
      page.getByText('Aucun Pokémon ne s’appelle « inconnu ».'),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Retour à ma liste' }).click()
    await expect(page).toHaveURL('/')
    await expect(
      page.getByRole('heading', { name: 'Pokémon à capturer' }),
    ).toBeVisible()
  })

  // Un cache de route Nitro retire « - », espaces… de ses clés : sans
  // validation avant le cache, ces noms tomberaient sur la fiche de Pikachu.
  for (const name of ['pika-chu', 'pika%20chu', 'pika_chu']) {
    test(`404 : « ${name} » n’affiche pas Pikachu (même en cache)`, async ({
      page,
      request,
    }) => {
      expect((await request.get('/api/pokemon/profile/pikachu')).status()).toBe(
        200,
      )

      const response = await page.goto(`/pokemon/${name}`)
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Pokémon introuvable',
      )
    })
  }

  test('majuscules : /pokemon/PIKACHU redirige vers /pokemon/pikachu', async ({
    page,
    request,
  }) => {
    const redirect = await request.get('/pokemon/PIKACHU', { maxRedirects: 0 })
    expect(redirect.status()).toBe(301)
    expect(redirect.headers().location).toBe('/pokemon/pikachu')

    await page.goto('/pokemon/PIKACHU')
    await expect(page).toHaveURL('/pokemon/pikachu')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu')
  })

  test('PokéAPI en panne : 502 et bouton Réessayer', async ({ page }) => {
    const response = await page.goto('/pokemon/erreur-serveur')
    expect(response?.status()).toBe(502)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'PokéAPI indisponible',
    )
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  })

  test('depuis la liste : le nom d’une carte ouvre sa fiche', async ({
    page,
    request,
  }) => {
    // liste = [Pikachu] dans l'API Hono
    const list = (await (await request.get(`${API_URL}/wishlist`)).json()) as {
      pokemon: { id: number }
    }[]
    for (const item of list) {
      await request.delete(`${API_URL}/wishlist/${item.pokemon.id}`)
    }
    const added = await request.post(`${API_URL}/wishlist`, {
      data: {
        id: 25,
        name: 'Pikachu',
        sprite:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
      },
    })
    expect(added.status()).toBe(201)

    await page.goto('/')
    await page
      .locator('article h3')
      .getByRole('link', { name: 'Pikachu' })
      .click()

    await expect(page).toHaveURL('/pokemon/pikachu')
    await expectPikachuProfile(page)

    await page.getByRole('link', { name: '← Ma liste' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('article h3')).toHaveText(['Pikachu'])

    await request.delete(`${API_URL}/wishlist/25`)
  })
})
