// Faux PokéAPI pour les tests E2E : le serveur Nuxt l'appelle à la place de
// pokeapi.co (NUXT_POKEAPI_BASE), pour des tests sans réseau et stables.
//
//   GET /health                       -> 200
//   GET /api/v2/pokemon/{nom|id}      -> fixtures/pokemon-{nom}.json
//   GET /api/v2/pokemon-species/{id}  -> fixtures/species-{id}.json
//   GET /api/v2/pokemon/erreur-serveur -> 500 (simule une panne)
//   tout le reste                     -> 404
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url)))

const pikachu = fixture('pokemon-pikachu')
const POKEMON = new Map([
  ['pikachu', pikachu],
  [String(pikachu.id), pikachu],
])
const SPECIES = new Map([['25', fixture('species-25')]])

const port = Number(process.env.PORT) || 3202

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://localhost:${port}`)
  const [, api, version, resource, key] = pathname.split('/')

  if (pathname === '/health') return send(res, 200, { status: 'ok' })
  if (api !== 'api' || version !== 'v2' || !key) {
    return send(res, 404, 'Not Found')
  }

  if (resource === 'pokemon' && key === 'erreur-serveur') {
    return send(res, 500, 'Internal Server Error')
  }
  const data =
    resource === 'pokemon'
      ? POKEMON.get(key)
      : resource === 'pokemon-species'
        ? SPECIES.get(key)
        : undefined
  return data ? send(res, 200, data) : send(res, 404, 'Not Found')
}).listen(port, () => {
  console.warn(`Faux PokéAPI sur http://localhost:${port}`)
})
