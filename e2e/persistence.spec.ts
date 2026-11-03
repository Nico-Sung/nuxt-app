import { expect, test, type Page } from '@playwright/test'
import { dbWishlist, resetDatabase } from './db'
import { API_URL } from './env'

/**
 * Persistance : chaque action dans le navigateur arrive en base (relue en
 * SQL) et survit au rechargement et à un autre visiteur.
 */

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function blockImages(page: Page) {
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1PX }),
  )
}

test.beforeEach(async ({ page }) => {
  await resetDatabase()
  await blockImages(page)
})

test('ajout et suppression depuis le navigateur : la table suit', async ({
  page,
  browser,
}) => {
  await page.goto('/')
  await expect(page.locator('header .total')).toHaveText('0 / 6')

  // recherche réelle (route serveur Nuxt -> faux PokéAPI), ajout via l'API
  await page.getByRole('combobox').fill('pika')
  const posted = page.waitForResponse(
    (r) => r.url() === `${API_URL}/wishlist` && r.request().method() === 'POST',
  )
  await page.getByRole('option', { name: /Pikachu/ }).click()
  expect((await posted).status()).toBe(201)

  await expect(page.locator('article h3')).toHaveText(['Pikachu'])
  await expect.poll(dbWishlist).toEqual([{ pokemon_id: 25, name: 'Pikachu' }])

  // rechargement
  await page.reload()
  await expect(page.locator('article h3')).toHaveText(['Pikachu'])

  // un autre visiteur voit la même liste
  const other = await browser.newContext({ locale: 'fr-FR' })
  const otherPage = await other.newPage()
  await blockImages(otherPage)
  await otherPage.goto('/')
  await expect(otherPage.locator('article h3')).toHaveText(['Pikachu'])
  await other.close()

  // suppression
  await page.getByRole('button', { name: 'Retirer Pikachu' }).click()
  await expect(page.getByText('Ta liste est vide.')).toBeVisible()
  await expect.poll(dbWishlist).toEqual([])
})

test('ligne ajoutée directement en base : affichée par le navigateur', async ({
  page,
}) => {
  const { db } = await import('./db')
  await db()`
    insert into public.wishlist (pokemon_id, name, sprite)
    values (25, 'Pikachu', 'https://raw.githubusercontent.com/x/25.png')
  `
  await page.goto('/')
  await expect(page.locator('article h3')).toHaveText(['Pikachu'])
  await expect(page.locator('header .total')).toHaveText('1 / 6')
})
