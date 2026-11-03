import { expect, test, type Page } from '@playwright/test'
import { dbLikes, resetDatabase } from './db'
import { API_URL } from './env'

/**
 * Likes : navigateur -> API Hono -> table pokemon_likes (relue en SQL).
 * Total partagé entre visiteurs, « déjà aimé » retenu dans le navigateur.
 */

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const PIKACHU = {
  id: 25,
  name: 'Pikachu',
  sprite:
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
}

async function blockImages(page: Page) {
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1PX }),
  )
}

test.beforeEach(async ({ page }) => {
  await resetDatabase()
  await blockImages(page)
})

/** Bouton ♥ d'un Pokémon, quel que soit son état ou la langue. */
const likeButton = (page: Page, pokemon: string) =>
  page.getByRole('button', {
    name: new RegExp(`^(Aimer|Ne plus aimer|Like|Unlike) ${pokemon} \\(`),
  })

test.describe('likes', () => {
  test('sur une carte : +1 en base, gardé au rechargement, retiré au 2e clic', async ({
    page,
    request,
  }) => {
    expect(
      (await request.post(`${API_URL}/wishlist`, { data: PIKACHU })).status(),
    ).toBe(201)
    await page.goto('/')

    const button = likeButton(page, 'Pikachu')
    await expect(button).toHaveAccessibleName('Aimer Pikachu (0)')
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    const liked = page.waitForResponse(
      (r) =>
        r.url() === `${API_URL}/likes/25` && r.request().method() === 'POST',
    )
    await button.click()
    expect((await liked).status()).toBe(200)
    await expect(button).toHaveAccessibleName('Ne plus aimer Pikachu (1)')
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(dbLikes).toEqual([{ pokemon_id: 25, likes: 1 }])

    // persistance : le total vient de la base, « aimé » du navigateur
    await page.reload()
    await expect(button).toHaveAccessibleName('Ne plus aimer Pikachu (1)')
    await expect(button).toHaveAttribute('aria-pressed', 'true')

    await button.click()
    await expect(button).toHaveAccessibleName('Aimer Pikachu (0)')
    await expect.poll(dbLikes).toEqual([])
  })

  test('sur la fiche, puis retour à la liste : même total', async ({
    page,
    request,
  }) => {
    await request.post(`${API_URL}/wishlist`, { data: PIKACHU })
    await page.goto('/pokemon/pikachu')

    await likeButton(page, 'Pikachu').click()
    await expect(likeButton(page, 'Pikachu')).toHaveAccessibleName(
      'Ne plus aimer Pikachu (1)',
    )
    await expect.poll(dbLikes).toEqual([{ pokemon_id: 25, likes: 1 }])

    await page.getByRole('link', { name: '← Ma liste' }).click()
    await expect(page).toHaveURL('/')
    const card = page.locator('article', { hasText: 'Pikachu' })
    await expect(
      card.getByRole('button', { name: /Pikachu \(/ }),
    ).toHaveAccessibleName('Ne plus aimer Pikachu (1)')
  })

  test('partagé entre visiteurs : chacun ajoute son like', async ({
    browser,
  }) => {
    const visitors = await Promise.all([
      browser.newContext({ locale: 'fr-FR' }),
      browser.newContext({ locale: 'fr-FR' }),
    ])
    const [a, b] = await Promise.all(visitors.map((ctx) => ctx.newPage()))
    await Promise.all([blockImages(a!), blockImages(b!)])

    await a!.goto('/pokemon/pikachu')
    await likeButton(a!, 'Pikachu').click()
    await expect(likeButton(a!, 'Pikachu')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // l'autre visiteur voit le total, mais ne l'a pas encore aimé
    await b!.goto('/pokemon/pikachu')
    const other = likeButton(b!, 'Pikachu')
    await expect(other).toHaveAccessibleName('Aimer Pikachu (1)')
    await other.click()
    await expect(other).toHaveAccessibleName('Ne plus aimer Pikachu (2)')
    await expect.poll(dbLikes).toEqual([{ pokemon_id: 25, likes: 2 }])

    await Promise.all(visitors.map((ctx) => ctx.close()))
  })

  test.describe('en anglais', () => {
    test.use({ locale: 'en-US' })

    test('libellés traduits', async ({ page }) => {
      await page.goto('/pokemon/pikachu')
      const button = likeButton(page, 'Pikachu')
      await expect(button).toHaveAccessibleName('Like Pikachu (0)')
      await button.click()
      await expect(button).toHaveAccessibleName('Unlike Pikachu (1)')
    })
  })

  test('API des likes en panne : pas de bouton, la fiche reste utilisable', async ({
    page,
  }) => {
    await page.route(`${API_URL}/likes`, (route) => route.abort())
    await page.goto('/pokemon/pikachu')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu')
    await expect(page.locator('.abilities li').first()).toHaveText('Statik')
    await expect(likeButton(page, 'Pikachu')).toHaveCount(0)
  })
})
