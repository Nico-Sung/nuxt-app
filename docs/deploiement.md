# Déploiement et retour en arrière

## Où tourne quoi

| Partie                    | Où                                                     | Déployé par                                               |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Front Nuxt en SSR         | Vercel : https://pokemon-a-capturer.vercel.app         | CI, job « Deploy (Vercel) », après toute la CI sur `main` |
| Front Nuxt statique (SSG) | S3 + CloudFront : https://dmw3t5lkpaeli.cloudfront.net | CI, job « Deploy statique (S3 + CloudFront) »             |
| API Hono                  | AWS Lambda + API Gateway (eu-west-1)                   | à la main : `npm --prefix infra run deploy:api`           |
| Base de données           | Supabase                                               | migrations : `npm --prefix api run migrate`               |

Après les deux déploiements du front, le job « Contrôle de la production »
vérifie les URL critiques (API, SSR, SSG, codes HTTP) et compare les fiches
SSR / SSG sans JavaScript. Il se lance aussi à la main :
Actions → « Contrôle de la production » → Run workflow, ou `npm run check:prod`.

## Revenir à une version précédente

Actions → **« Revenir à une version précédente »** → Run workflow.

- **Sans commit** : remet le dernier déploiement stable avant celui en ligne.
  Stable = commit de `main` dont toute la CI a réussi (déploiements et
  contrôle de la production compris).
- **Avec un commit** : remet celui-là, s'il est stable (sinon refus).

Ce que fait le workflow :

1. **Vercel** : retrouve le déploiement de ce commit (Vercel garde le commit
   de chaque déploiement) et le remet en ligne avec `vercel promote`, sans
   rebuild. S'il est introuvable, reconstruit ce commit.
2. **CloudFront** : récupère le site généré lors du déploiement de ce commit
   (artefact `site-statique-<commit>`, gardé 30 jours), le synchronise dans S3
   et vide le cache. S'il a expiré, régénère ce commit.
3. **Contrôle de la production** en attendant ce commit : `/api/health`
   (Vercel) et `/version.json` (CloudFront) doivent l'afficher.

Le retour en arrière dure jusqu'au prochain push sur `main`, qui redéploie la
dernière version. Pour revenir tout de suite à la dernière version, relancer
le workflow avec son commit.

### Ce qui n'est pas remis en arrière

- **L'API** : redéployer un ancien commit à la main
  (`git checkout <commit> -- api infra` puis `npm --prefix infra run deploy:api`).
- **La base** : les migrations ne font qu'ajouter (tables, colonnes) ; une
  version précédente du site fonctionne avec le schéma actuel.
