/* eslint-disable @typescript-eslint/no-require-imports */
const esbuild = require('esbuild')
const path = require('path')

const root = path.join(__dirname, '..')

esbuild
  .build({
    entryPoints: [path.join(__dirname, 'src', 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.join(__dirname, 'lib', 'index.js'),
    format: 'cjs',
    sourcemap: true,
    logLevel: 'info',
    alias: {
      // Resolución explícita si hiciera falta
    },
    // Código compartido del monorepo (sin duplicar lógica)
    absWorkingDir: __dirname,
    external: [
      'firebase-admin',
      'firebase-functions',
      'firebase-functions/v2',
      'firebase-functions/v2/https',
      'archiver',
      'exceljs',
    ],
  })
  .catch(() => process.exit(1))
