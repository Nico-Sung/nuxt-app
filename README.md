# Pokémon à capturer

[![CI](https://github.com/Nico-Sung/nuxt-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Nico-Sung/nuxt-app/actions/workflows/ci.yml)
[![coverage front](https://raw.githubusercontent.com/Nico-Sung/nuxt-app/badges/coverage-front.svg)](https://github.com/Nico-Sung/nuxt-app/tree/badges)
[![coverage API](https://raw.githubusercontent.com/Nico-Sung/nuxt-app/badges/coverage-api.svg)](https://github.com/Nico-Sung/nuxt-app/tree/badges)

Liste de 6 Pokémon à capturer : recherche (français ou anglais), fiches,
likes. Interface en français et en anglais.

- **SSR (Vercel)** : https://pokemon-a-capturer.vercel.app
- **SSG (S3 + CloudFront)** : https://dmw3t5lkpaeli.cloudfront.net
- **Rapport de couverture** : branche [`badges`](https://github.com/Nico-Sung/nuxt-app/tree/badges), mis à jour à chaque push sur `main`

## Architecture

| Dossier                      | Contenu                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `app/`, `server/`, `shared/` | front Nuxt 4 (pages, composants, routes serveur PokéAPI)          |
| `api/`                       | API Hono (liste, likes) : Node en local, AWS Lambda en production |
| `infra/`                     | AWS CDK : Lambda + API Gateway, S3 + CloudFront                   |
| `supabase/migrations/`       | schéma Postgres (runner SQL maison)                               |
| `i18n/locales/`              | traductions FR / EN                                               |
| `e2e/`                       | tests Playwright (navigateur → Nuxt → API → Postgres)             |

## Commandes

```bash
npm install && npm --prefix api install
npm run dev                 # front, http://localhost:3000
npm run dev:api             # API, http://localhost:3001

npm test                    # tests unitaires du front
npm run test:coverage       # … avec la couverture (coverage/index.html)
npm --prefix api test       # tests unitaires de l'API
npm --prefix api run db:test:up && npm --prefix api run test:db   # API sur Postgres
npm run build && npm run test:e2e                                  # E2E Playwright

npm run lint && npm run format:check && npm run typecheck && npm run i18n:check
npm run check:prod          # contrôle de la production
```

## Déploiement

Tout passe par la CI : après réussite de tous les jobs sur `main`, le front est
déployé sur Vercel (SSR) et sur S3 + CloudFront (SSG), puis la production est
contrôlée. Retour à une version précédente : workflow « Revenir à une version
précédente ». Détails : [docs/deploiement.md](docs/deploiement.md).
