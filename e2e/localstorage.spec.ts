import { test as base, expect, type Page } from '@playwright/test'

const STORAGE_KEY = 'pokemon-a-capturer'

const SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

const PIKACHU = { id: 25, name: 'Pikachu', sprite: SPRITE(25) }
const EEVEE = { id: 133, name: 'Eevee', sprite: SPRITE(133) }
const ALL = [PIKACHU, EEVEE]

const DETAILS: Record<number, unknown> = {
  25: {
    id: 25,
    types: ['electric'],
    stats: {
      hp: 35,
      attack: 55,
      defense: 40,
      'special-attack': 50,
      'special-defense': 50,
      speed: 90,
    },
    height: 4,
    weight: 60,
  },
  133: {
    id: 133,
    types: ['normal'],
    stats: {
      hp: 55,
      attack: 55,
      defense: 50,
      'special-attack': 45,
      'special-defense': 65,
      speed: 55,
    },
    height: 3,
    weight: 65,
  },
}

/** PNG transparent 1×1, servi à la place des images PokéAPI. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/** Simule notre API et les images : aucun appel à PokéAPI pendant les tests. */
async function mockNetwork(page: Page) {
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1PX }),
  )

  await page.route('**/api/pokemon/**', (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/api/pokemon/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      return route.fulfill({
        json: ALL.filter((p) => p.name.toLowerCase().includes(q)),
      })
    }

    const id = Number(url.pathname.split('/').pop())
    return DETAILS[id]
      ? route.fulfill({ json: DETAILS[id] })
      : route.fulfill({ status: 404, json: { statusCode: 404 } })
  })
}

/**
 * `errors` : exceptions JS non attrapées et console.error de la page.
 * Vérifié automatiquement à la fin de chaque test -> l'app ne doit jamais planter.
 */
const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
      })
      await mockNetwork(page)
      await use(errors)
      expect(errors, 'erreurs JavaScript dans la page').toEqual([])
    },
    { auto: true },
  ],
})

/** Écrit `value` dans le localStorage avant le chargement de la page. */
async function seedStorage(page: Page, value: string) {
  await page.addInitScript(([key, v]) => window.localStorage.setItem(key, v), [
    STORAGE_KEY,
    value,
  ] as const)
}

function readStorage(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
}

async function readStoredItems(page: Page) {
  const raw = await readStorage(page)
  return raw === null ? null : (JSON.parse(raw) as unknown[])
}

/** Ouvre l'app et attend que la liste soit relue depuis le stockage. */
async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('header .total')).toBeVisible()
}

const counter = (page: Page) => page.locator('header .total')
const cardTitles = (page: Page) => page.locator('article h3')
const emptyMessage = (page: Page) =>
  page.getByText("Ta liste est vide. Recherche un Pokémon pour l'ajouter.")

async function addFromSearch(page: Page, query: string, name: string) {
  await page
    .getByRole('combobox', { name: 'Rechercher un Pokémon' })
    .fill(query)
  await page.getByRole('option', { name: new RegExp(name) }).click()
}

test.describe('localStorage', () => {
  test('sauvegarde : un ajout est écrit dans le stockage et survit au rechargement', async ({
    page,
  }) => {
    await openApp(page)
    await addFromSearch(page, 'pika', 'Pikachu')

    await expect(cardTitles(page)).toHaveText(['Pikachu'])
    await expect
      .poll(() => readStoredItems(page))
      .toEqual([
        {
          pokemon: PIKACHU,
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
        },
      ])

    await page.reload()
    await expect(counter(page)).toHaveText('1 / 6')
    await expect(cardTitles(page)).toHaveText(['Pikachu'])

    await page.getByRole('button', { name: 'Retirer Pikachu' }).click()
    await expect.poll(() => readStorage(page)).toBe('[]')
    await expect(emptyMessage(page)).toBeVisible()
  })

  test('lecture : une liste stockée est affichée au chargement', async ({
    page,
  }) => {
    await seedStorage(
      page,
      JSON.stringify([
        { pokemon: PIKACHU, addedAt: '2026-11-01T10:00:00.000Z' },
        { pokemon: EEVEE, addedAt: '2026-11-02T10:00:00.000Z' },
      ]),
    )
    await openApp(page)

    await expect(counter(page)).toHaveText('2 / 6')
    // les plus récents d'abord
    await expect(cardTitles(page)).toHaveText(['Eevee', 'Pikachu'])
  })

  test('stockage vide : pas de clé', async ({ page }) => {
    await openApp(page)

    expect(await readStorage(page)).toBeNull()
    await expect(counter(page)).toHaveText('0 / 6')
    await expect(emptyMessage(page)).toBeVisible()
  })

  test('stockage vide : tableau vide', async ({ page }) => {
    await seedStorage(page, '[]')
    await openApp(page)

    await expect(counter(page)).toHaveText('0 / 6')
    await expect(emptyMessage(page)).toBeVisible()
  })

  test("JSON invalide : l'application ne plante pas et reste utilisable", async ({
    page,
  }) => {
    await seedStorage(page, '{pas du json')
    await openApp(page)

    await expect(
      page.getByRole('heading', { name: 'Pokémon à capturer' }),
    ).toBeVisible()
    await expect(counter(page)).toHaveText('0 / 6')
    await expect(emptyMessage(page)).toBeVisible()

    // l'app fonctionne toujours et réécrit un JSON valide
    await addFromSearch(page, 'pika', 'Pikachu')
    await expect(cardTitles(page)).toHaveText(['Pikachu'])
    await expect
      .poll(() => readStoredItems(page))
      .toEqual([{ pokemon: PIKACHU, addedAt: expect.any(String) }])
  })

  test("JSON valide mais pas un tableau : l'application ne plante pas", async ({
    page,
  }) => {
    await seedStorage(page, '{"a":1}')
    await openApp(page)

    await expect(counter(page)).toHaveText('0 / 6')
    await expect(emptyMessage(page)).toBeVisible()
  })

  test('entrées invalides : seules les entrées valides sont affichées', async ({
    page,
  }) => {
    await seedStorage(
      page,
      JSON.stringify([
        null,
        42,
        { pokemon: { id: 'x' }, addedAt: '2026-11-01T10:00:00.000Z' },
        { pokemon: EEVEE, addedAt: 'pas une date' },
        { pokemon: PIKACHU, addedAt: '2026-11-01T10:00:00.000Z' },
      ]),
    )
    await openApp(page)

    await expect(counter(page)).toHaveText('1 / 6')
    await expect(cardTitles(page)).toHaveText(['Pikachu'])
  })
})
