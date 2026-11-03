# Couverture des tests

Dernier rapport de `main` : commit [`bd74242`](https://github.com/Nico-Sung/nuxt-app/commit/bd7424244d14a3cbcfc2b8dbb01d70cefe7188f3), 2026-11-03 21:21 UTC.
Rapports HTML complets (fichier par fichier, ligne par ligne) : artefacts `coverage-front-html` et `coverage-api-html` du [run](https://github.com/Nico-Sung/nuxt-app/actions/runs/41720942178).

![coverage front](coverage-front.svg) ![coverage API](coverage-api.svg)

### Couverture front (logique TS) : 87,8 % des lignes

| | Lignes | Instructions | Fonctions | Branches |
|---|---|---|---|---|
| **Total** | 87,8 % (412/469) | 87 % (474/545) | 92,9 % (143/154) | 73,3 % (297/405) |

<details><summary>Les 10 fichiers les moins couverts (sur 18)</summary>

| Fichier | Lignes | Branches |
|---|---|---|
| `scripts/coverage-report.mjs` | 61,7 % (29/47) | 54,3 % (19/35) |
| `scripts/compare-ssr-ssg.mjs` | 73,3 % (44/60) | 54,4 % (37/68) |
| `scripts/check-production.mjs` | 84,8 % (67/79) | 61,2 % (63/103) |
| `scripts/check-locales.mjs` | 91,3 % (84/92) | 80,3 % (57/71) |
| `app/utils/likesApi.ts` | 93,3 % (14/15) | 83,3 % (5/6) |
| `app/utils/wishlistApi.ts` | 96,6 % (28/29) | 94,4 % (17/18) |
| `shared/utils/pokeapiClient.ts` | 96,9 % (31/32) | 91,7 % (22/24) |
| `app/utils/wishlist.ts` | 100 % (4/4) | 100 % (0/0) |
| `build/pokemonRoutes.ts` | 100 % (20/20) | 100 % (12/12) |
| `server/lib/pokeapi.ts` | 100 % (7/7) | 87,5 % (7/8) |

</details>

### Couverture API : 93,3 % des lignes

| | Lignes | Instructions | Fonctions | Branches |
|---|---|---|---|---|
| **Total** | 93,3 % (195/209) | 92,4 % (220/238) | 91,9 % (68/74) | 85,2 % (109/128) |

<details><summary>Les 10 fichiers les moins couverts (sur 10)</summary>

| Fichier | Lignes | Branches |
|---|---|---|
| `src/lambda.ts` | 83,3 % (10/12) | 90 % (9/10) |
| `src/migrations.ts` | 89,8 % (53/59) | 74,1 % (20/27) |
| `src/app.ts` | 91,1 % (51/56) | 88,5 % (23/26) |
| `src/postgresStore.ts` | 96,7 % (29/30) | 70 % (14/20) |
| `src/i18n.ts` | 100 % (13/13) | 91,7 % (11/12) |
| `src/likes.ts` | 100 % (11/11) | 100 % (4/4) |
| `src/locales/en.json` | 100 % (1/1) | 100 % (0/0) |
| `src/locales/fr.json` | 100 % (1/1) | 100 % (0/0) |
| `src/version.ts` | 100 % (5/5) | 100 % (4/4) |
| `src/wishlist.ts` | 100 % (21/21) | 96 % (24/25) |

</details>

_Front : logique TypeScript testée par Vitest (app/utils, shared/utils, server/lib, build, scripts) ; les composants .vue, composables et routes Nuxt sont couverts par les tests E2E Playwright. API : tests unitaires + tests sur Postgres réunis._
