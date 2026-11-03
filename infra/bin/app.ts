import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { App } from 'aws-cdk-lib'
import { ApiStack } from '../lib/api-stack.js'
import { StaticStack } from '../lib/static-stack.js'

const apiPackage = JSON.parse(
  readFileSync(new URL('../../api/package.json', import.meta.url), 'utf8'),
) as { version: string }

/** Commit déployé (GITHUB_SHA en CI, sinon le HEAD local). */
function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

const app = new App()

new ApiStack(app, 'PokemonApi', {
  // Même région que le pooler Supabase (aws-0-eu-west-1) : latence minimale.
  env: {
    region: 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  version: apiPackage.version,
  gitSha: gitSha(),
  // Front Nuxt : production (Vercel, site statique CloudFront) + dev local et E2E.
  corsOrigin:
    process.env.CORS_ORIGIN ??
    [
      'https://pokemon-a-capturer.vercel.app',
      'https://dmw3t5lkpaeli.cloudfront.net',
      'http://localhost:3000',
      'http://localhost:3200',
    ].join(','),
  databaseUrlParameter: '/pokemon-api/database-url',
  tags: { project: 'pokemon-wishlist' },
})

// Site statique (nuxt generate) : S3 + CloudFront, déployé par GitHub Actions.
new StaticStack(app, 'PokemonStatic', {
  env: {
    region: 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  githubRepository: 'Nico-Sung/nuxt-app',
  githubEnvironment: 'static',
  tags: { project: 'pokemon-wishlist' },
})
