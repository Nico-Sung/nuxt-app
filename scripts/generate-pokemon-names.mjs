// @ts-check
/**
 * Génère shared/data/pokemon-names.json : noms officiels des Pokémon (espèces)
 * et des talents, en anglais et en français, depuis PokéAPI.
 *
 *   node scripts/generate-pokemon-names.mjs
 *
 * À relancer quand de nouveaux Pokémon sortent. Le fichier est commité :
 * l'app traduit les noms sans aucun appel à PokéAPI à l'exécution.
 * Environ 1 400 requêtes (une par espèce et par talent), 8 en parallèle.
 */
import { writeFileSync } from 'node:fs'

const BASE = 'https://pokeapi.co/api/v2'
const LANGUAGES = /** @type {const} */ (['en', 'fr'])
const OUTPUT = new URL('../shared/data/pokemon-names.json', import.meta.url)
const CONCURRENCY = 8

/**
 * @typedef {{ name: string, language: { name: string } }} PokeApiName
 * @typedef {{ id: number, name: string, names: PokeApiName[] }} PokeApiNamed
 * @typedef {Partial<Record<'en' | 'fr', string>>} Names
 */

/** @param {string} url @returns {Promise<any>} */
async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (error) {
    if (attempt >= 4) throw new Error(`${url} : ${error}`, { cause: error })
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
    return getJson(url, attempt + 1)
  }
}

/**
 * Applique `fn` à chaque élément, `CONCURRENCY` à la fois.
 * @template T, R
 * @param {T[]} items
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapLimit(items, fn) {
  /** @type {R[]} */
  const results = new Array(items.length)
  let next = 0
  let done = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(/** @type {T} */ (items[index]))
      done++
      if (done % 100 === 0) process.stderr.write(`  ${done}/${items.length}\n`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

/** @param {PokeApiNamed} data @returns {Names} */
function pickNames(data) {
  /** @type {Names} */
  const names = {}
  for (const lang of LANGUAGES) {
    const entry = data.names.find((n) => n.language.name === lang)
    if (entry) names[lang] = entry.name
  }
  return names
}

/** @param {string} resource @returns {Promise<PokeApiNamed[]>} */
async function fetchAll(resource) {
  const list = await getJson(`${BASE}/${resource}?limit=100000`)
  /** @type {string[]} */
  const urls = list.results.map((/** @type {{ url: string }} */ r) => r.url)
  process.stderr.write(`${resource} : ${urls.length}\n`)
  return mapLimit(urls, getJson)
}

/** Un objet par ligne : diffs lisibles quand le fichier est régénéré. */
function serialize(/** @type {Record<string, Record<string, Names>>} */ data) {
  const sections = Object.entries(data).map(([section, entries]) => {
    const lines = Object.entries(entries).map(
      ([key, names]) => `    ${JSON.stringify(key)}: ${JSON.stringify(names)}`,
    )
    return `  ${JSON.stringify(section)}: {\n${lines.join(',\n')}\n  }`
  })
  return `{\n${sections.join(',\n')}\n}\n`
}

const species = await fetchAll('pokemon-species')
const abilities = await fetchAll('ability')

/** @type {Record<string, Names>} */
const speciesNames = {}
for (const s of species.sort((a, b) => a.id - b.id)) {
  speciesNames[String(s.id)] = pickNames(s)
}

/** @type {Record<string, Names>} */
const abilityNames = {}
for (const a of abilities.sort((x, y) => x.name.localeCompare(y.name))) {
  const names = pickNames(a)
  if (names.en || names.fr) abilityNames[a.name] = names
}

writeFileSync(
  OUTPUT,
  serialize({ species: speciesNames, abilities: abilityNames }),
)

const missingFr = Object.values(speciesNames).filter((n) => !n.fr).length
process.stderr.write(
  `✓ ${Object.keys(speciesNames).length} espèces (${missingFr} sans nom français), ` +
    `${Object.keys(abilityNames).length} talents -> ${OUTPUT.pathname}\n`,
)
