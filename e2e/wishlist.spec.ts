import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import { API_URL } from './env'

/**
 * Parcours réel : navigateur → Nuxt → API Hono (GET/POST/DELETE /wishlist).
 * Seul ce qui dépend de PokéAPI (recherche, stats, images) est simulé.
 */

interface Pokemon {
  id: number
  name: string
  sprite: string
}

/** Pokémon du catalogue + son nom affiché en français (l'API garde l'anglais). */
interface CatalogPokemon extends Pokemon {
  fr: string
}

const SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

const poke = (id: number, name: string, fr = name): CatalogPokemon => ({
  id,
  name,
  sprite: SPRITE(id),
  fr,
})

/** Ce que l'API stocke (sans le nom affiché). */
const stored = ({ id, name, sprite }: Pokemon): Pokemon => ({
  id,
  name,
  sprite,
})

const PIKACHU = poke(25, 'Pikachu')
const EEVEE = poke(133, 'Eevee', 'Évoli')
const SNORLAX = poke(143, 'Snorlax', 'Ronflex')
/** 8 Pokémon : de quoi remplir la liste (6) et en refuser un 7ᵉ. */
const CATALOG: CatalogPokemon[] = [
  poke(1, 'Bulbasaur', 'Bulbizarre'),
  poke(4, 'Charmander', 'Salamèche'),
  poke(7, 'Squirtle', 'Carapuce'),
  PIKACHU,
  poke(39, 'Jigglypuff', 'Rondoudou'),
  EEVEE,
  SNORLAX,
  poke(151, 'Mew'),
]

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/** Simule uniquement PokéAPI (routes Nuxt /api/pokemon/* et images). */
async function mockPokeApi(page: Page) {
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1PX }),
  )
  await page.route('**/api/pokemon/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/pokemon/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      return route.fulfill({
        json: CATALOG.filter((p) => p.name.toLowerCase().includes(q)).map(
          stored,
        ),
      })
    }
    const id = Number(url.pathname.split('/').pop())
    return route.fulfill({
      json: {
        id,
        types: ['normal'],
        stats: {
          hp: 50,
          attack: 50,
          defense: 50,
          'special-attack': 50,
          'special-defense': 50,
          speed: 50,
        },
        height: 5,
        weight: 50,
      },
    })
  })
}

// ---------- accès direct à l'API Hono (préparation + vérifications) ----------

async function apiList(request: APIRequestContext): Promise<Pokemon[]> {
  const res = await request.get(`${API_URL}/wishlist`)
  expect(res.status()).toBe(200)
  const items = (await res.json()) as { pokemon: Pokemon }[]
  return items.map((i) => i.pokemon)
}

const apiNames = async (request: APIRequestContext) =>
  (await apiList(request)).map((p) => p.name)

async function apiAdd(request: APIRequestContext, pokemon: Pokemon) {
  const res = await request.post(`${API_URL}/wishlist`, {
    data: stored(pokemon),
  })
  expect(res.status()).toBe(201)
}

async function apiClear(request: APIRequestContext) {
  for (const p of await apiList(request)) {
    await request.delete(`${API_URL}/wishlist/${p.id}`)
  }
  expect(await apiList(request)).toEqual([])
}

// ---------- fixture : liste vide + PokéAPI simulée + détecteur de plantage ----------

const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page, request }, use) => {
      await apiClear(request)
      await mockPokeApi(page)
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await use(errors)
      expect(errors, 'exceptions JavaScript dans la page').toEqual([])
    },
    { auto: true },
  ],
})

// ---------- helpers UI ----------

const counter = (page: Page) => page.locator('header .total')
const cardTitles = (page: Page) => page.locator('article h3')
const searchBox = (page: Page) =>
  page.getByRole('combobox', { name: 'Rechercher un Pokémon' })
/** Résultat de recherche par nom affiché (« Évoli » : pas de \b avant un É). */
const result = (page: Page, name: string) =>
  page.getByRole('option', { name: new RegExp(`(^|\\s)${name}(\\s|$)`) })
const FULL_NOTICE = /Liste pleine \(6 Pokémon max\)/
/** Message visible « Liste pleine » (pas la zone lue par les lecteurs d'écran). */
const fullNotice = (page: Page) =>
  page.locator('p.notice', { hasText: FULL_NOTICE })

/** Ouvre l'app et attend que la liste soit chargée depuis l'API. */
async function openApp(page: Page) {
  await page.goto('/')
  await expect(counter(page)).toBeVisible()
}

async function search(page: Page, query: string) {
  await searchBox(page).fill(query)
}

/** Ajoute via l'UI (recherche par nom anglais, clic sur le nom affiché) ; attend le 201. */
async function addViaUi(page: Page, pokemon: CatalogPokemon) {
  await search(page, pokemon.name)
  const posted = page.waitForResponse(
    (r) => r.url() === `${API_URL}/wishlist` && r.request().method() === 'POST',
  )
  await result(page, pokemon.fr).click()
  expect((await posted).status()).toBe(201)
}

// ---------- parcours ----------

test.describe('parcours wishlist Nuxt + API Hono', () => {
  test('ajout : le Pokémon ajouté dans Nuxt est enregistré par l’API', async ({
    page,
    request,
  }) => {
    await openApp(page)
    await expect(counter(page)).toHaveText('0 / 6')

    await addViaUi(page, PIKACHU)

    await expect(cardTitles(page)).toHaveText(['Pikachu'])
    await expect(counter(page)).toHaveText('1 / 6')
    expect(await apiNames(request)).toEqual(['Pikachu'])

    // persisté côté API : toujours là après rechargement
    await page.reload()
    await expect(cardTitles(page)).toHaveText(['Pikachu'])
  })

  test('doublon (UI) : un Pokémon déjà dans la liste ne peut pas être ajouté', async ({
    page,
    request,
  }) => {
    await apiAdd(request, PIKACHU)
    await openApp(page)

    await search(page, 'pika')
    const option = result(page, 'Pikachu')
    await expect(option).toContainText('Dans la liste')
    await expect(option).toHaveAttribute('aria-disabled', 'true')

    // clic forcé : Playwright refuse sinon de cliquer un élément désactivé
    await option.click({ force: true })
    await expect(cardTitles(page)).toHaveText(['Pikachu'])
    expect(await apiNames(request)).toEqual(['Pikachu'])
  })

  test('doublon (API 409) : message et resynchronisation', async ({
    page,
    request,
  }) => {
    await openApp(page)
    // ajouté ailleurs pendant que la page est ouverte : l'UI n'est plus à jour
    await apiAdd(request, PIKACHU)

    await search(page, 'pika')
    const posted = page.waitForResponse(
      (r) =>
        r.url() === `${API_URL}/wishlist` && r.request().method() === 'POST',
    )
    await result(page, 'Pikachu').click()
    expect((await posted).status()).toBe(409)

    await expect(page.getByRole('alert')).toHaveText(
      'Pikachu est déjà dans la liste.',
    )
    await expect(cardTitles(page)).toHaveText(['Pikachu'])
    expect(await apiNames(request)).toEqual(['Pikachu'])
  })

  test('limite 6 (UI) : le 7ᵉ Pokémon est bloqué', async ({
    page,
    request,
  }) => {
    await openApp(page)

    for (const pokemon of CATALOG.slice(0, 6)) {
      await addViaUi(page, pokemon)
    }

    await expect(counter(page)).toHaveText('6 / 6')
    await expect(fullNotice(page)).toBeVisible()

    await search(page, 'Snorlax')
    const option = result(page, SNORLAX.fr)
    await expect(option).toContainText('Liste pleine')
    await expect(option).toHaveAttribute('aria-disabled', 'true')
    // clic forcé : Playwright refuse sinon de cliquer un élément désactivé
    await option.click({ force: true })

    expect(await apiList(request)).toHaveLength(6)
    expect(await apiNames(request)).not.toContain('Snorlax')
  })

  test('limite 6 (API 409) : refus du serveur et resynchronisation', async ({
    page,
    request,
  }) => {
    for (const pokemon of CATALOG.slice(0, 5)) await apiAdd(request, pokemon)
    await openApp(page)
    await expect(counter(page)).toHaveText('5 / 6')

    // 6ᵉ ajouté ailleurs : l'UI croit encore qu'il reste une place
    await apiAdd(request, CATALOG[5]!)

    await search(page, 'Snorlax')
    const posted = page.waitForResponse(
      (r) =>
        r.url() === `${API_URL}/wishlist` && r.request().method() === 'POST',
    )
    await result(page, SNORLAX.fr).click()
    expect((await posted).status()).toBe(409)

    await expect(counter(page)).toHaveText('6 / 6')
    await expect(fullNotice(page)).toBeVisible()
    expect(await apiList(request)).toHaveLength(6)
    expect(await apiNames(request)).not.toContain('Snorlax')
  })

  test('suppression : retirer dans Nuxt supprime dans l’API', async ({
    page,
    request,
  }) => {
    await apiAdd(request, PIKACHU)
    await apiAdd(request, EEVEE)
    await openApp(page)
    await expect(counter(page)).toHaveText('2 / 6')

    await page.getByRole('button', { name: 'Retirer Pikachu' }).click()

    await expect(cardTitles(page)).toHaveText([EEVEE.fr])
    await expect(counter(page)).toHaveText('1 / 6')
    await expect.poll(() => apiNames(request)).toEqual(['Eevee'])
  })

  test('tout vider : la liste est vidée dans l’API', async ({
    page,
    request,
  }) => {
    for (const pokemon of CATALOG.slice(0, 3)) await apiAdd(request, pokemon)
    await openApp(page)
    await expect(counter(page)).toHaveText('3 / 6')

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Tout vider' }).click()

    await expect(
      page.getByText("Ta liste est vide. Recherche un Pokémon pour l'ajouter."),
    ).toBeVisible()
    await expect(counter(page)).toHaveText('0 / 6')
    await expect.poll(() => apiList(request)).toEqual([])
  })
})
