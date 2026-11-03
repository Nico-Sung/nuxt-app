// Paquet Lambda : src/lambda.ts et ses dépendances (hono, postgres…) en un seul
// fichier ESM, dist-lambda/index.mjs. Le SDK AWS est fourni par le runtime Node.
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/lambda.ts'],
  outfile: 'dist-lambda/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['@aws-sdk/*'],
  // Certaines dépendances utilisent require() : on le fournit en ESM.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  sourcemap: true,
  metafile: true,
  logLevel: 'warning',
})

const bytes = Object.values(result.metafile.outputs).reduce(
  (sum, output) => sum + output.bytes,
  0,
)
console.warn(
  `dist-lambda/index.mjs : ${(bytes / 1024).toFixed(0)} Ko (avec la source map)`,
)
