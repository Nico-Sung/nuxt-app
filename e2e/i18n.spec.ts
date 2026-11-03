import { expect, test, type Page } from '@playwright/test'
import { API_URL } from './env'

/**
 * Traduction FR/EN : sélecteur de langue, cookie, langue du navigateur,
 * fiche (textes PokéAPI dans la langue), page d'erreur et appels à l'API.
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

const EN_DESCRIPTION =
  'When several of these POKéMON gather, their electricity could build and cause lightning storms.'
const FR_DESCRIPTION =
  'Il lui arrive de remettre sur pied un Pikachu allié en lui envoyant une décharge électrique.'

/** Liste de l'API Hono vidée, puis remplie avec `pokemon`. */
async function resetList(page: Page, pokemon: (typeof PIKACHU)[] = []) {
  const { request } = page
  const items = (await (await request.get(`${API_URL}/wishlist`)).json()) as {
    pokemon: { id: number }
  }[]
  for (const item of items) {
    await request.delete(`${API_URL}/wishlist/${item.pokemon.id}`)
  }
  for (const p of pokemon) {
    expect(
      (await request.post(`${API_URL}/wishlist`, { data: p })).status(),
    ).toBe(201)
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1PX }),
  )
  await resetList(page)
})

const languageButton = (page: Page, name: 'Français' | 'English') =>
  page.getByRole('button', { name, exact: true })

test.describe('sélecteur de langue', () => {
  test('passe de français à anglais, et le choix survit au rechargement', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page).toHaveTitle('Pokémon à capturer')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pokémon à capturer',
    )
    await expect(languageButton(page, 'Français')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByText('Ta liste est vide.')).toBeVisible()

    await languageButton(page, 'English').click()

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveTitle('Pokémon to catch')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pokémon to catch',
    )
    await expect(languageButton(page, 'English')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(
      page.getByRole('combobox', { name: 'Search for a Pokémon' }),
    ).toHaveAttribute('placeholder', 'Search for a Pokémon (name, no. or #025)')
    await expect(
      page.getByText('Your list is empty. Search for a Pokémon to add it.'),
    ).toBeVisible()

    // mémorisé dans un cookie, relu par le rendu serveur
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === 'i18n_locale')?.value).toBe('en')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pokémon to catch',
    )

    await languageButton(page, 'Français').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pokémon à capturer',
    )
  })

  test('la liste et les appels à l’API suivent la langue', async ({ page }) => {
    await resetList(page, [PIKACHU])
    await page.goto('/')
    await languageButton(page, 'English').click()

    const card = page.locator('article', { hasText: 'Pikachu' })
    await expect(
      card.getByRole('button', { name: 'Remove Pikachu' }),
    ).toHaveText('Remove')
    await expect(page.locator('header .total')).toHaveAttribute(
      'aria-label',
      '1 of 6 in the list',
    )
    await expect(page.getByRole('heading', { name: /My list/ })).toBeVisible()

    const deleted = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url() === `${API_URL}/wishlist/25`,
    )
    await card.getByRole('button', { name: 'Remove Pikachu' }).click()
    expect((await deleted).headers()['accept-language']).toBe('en')
    await expect(
      page.getByText('Your list is empty. Search for a Pokémon to add it.'),
    ).toBeVisible()
  })
})

test.describe('langue du navigateur (sans cookie)', () => {
  test.describe('navigateur en anglais', () => {
    test.use({ locale: 'en-US' })

    test('arrive directement en anglais', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Pokémon to catch',
      )
    })
  })

  test.describe('navigateur en allemand (non géré)', () => {
    test.use({ locale: 'de-DE' })

    test('retombe sur le français', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Pokémon à capturer',
      )
    })
  })
})

test.describe('fiche et erreurs en anglais', () => {
  test.use({ locale: 'en-US' })

  test('fiche : textes, unités et description PokéAPI en anglais', async ({
    page,
  }) => {
    const response = await page.goto('/pokemon/pikachu')
    expect(response?.status()).toBe(200)

    await expect(page).toHaveTitle('Pikachu · Pokémon to catch')
    const profile = page.locator('article.profile')
    await expect(profile.locator('.genus')).toHaveText('Mouse Pokémon')
    await expect(profile.locator('.description')).toHaveText(EN_DESCRIPTION)
    await expect(profile.getByRole('list', { name: 'Types' })).toHaveText(
      'Electric',
    )
    await expect(profile.locator('.facts')).toContainText('Height0.4 m')
    await expect(profile.locator('.facts')).toContainText('Weight6 kg')
    await expect(profile.locator('.abilities li')).toHaveText([
      'Static',
      'Lightning Rod (hidden)',
    ])
    const stats = profile.getByRole('region', { name: 'Base stats' })
    await expect(stats.locator('.stat').first()).toHaveText('HP35')
    await expect(page.getByRole('link', { name: '← My list' })).toBeVisible()
  })

  test('fiche : changer de langue recharge la description', async ({
    page,
  }) => {
    await page.goto('/pokemon/pikachu')
    await expect(page.locator('.description')).toHaveText(EN_DESCRIPTION)

    await languageButton(page, 'Français').click()

    await expect(page.locator('.description')).toHaveText(FR_DESCRIPTION)
    await expect(page.locator('.genus')).toHaveText('Pokémon Souris')
    await expect(page.locator('.facts')).toContainText('Taille0,4 m')
    await expect(page).toHaveTitle('Pikachu · Pokémon à capturer')
  })

  test('404 en anglais', async ({ page }) => {
    const response = await page.goto('/pokemon/inconnu')
    expect(response?.status()).toBe(404)

    await expect(page).toHaveTitle('Pokémon not found · Pokémon to catch')
    await expect(page.getByText('Error 404')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pokémon not found',
    )
    await expect(
      page.getByText('No Pokémon is called “inconnu”.'),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Back to my list' }),
    ).toBeVisible()
  })

  test('502 en anglais', async ({ page }) => {
    const response = await page.goto('/pokemon/erreur-serveur')
    expect(response?.status()).toBe(502)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'PokéAPI unavailable',
    )
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  })
})
