import { defineConfig } from 'tsdown'

/**
 * Two bundles from one source tree:
 * - src/index.ts → lib/index.js  (host half, Node ESM; peer deps never bundled)
 * - src/client/index.ts → lib/client.js (browser half, CommonJS so the
 *   post-build wrap script can enclose it in the dsh __ModuleLoader__ factory;
 *   react/react-dom and @deepseek-ai/* never bundled; the stylesheet is
 *   embedded as a TS string — no CSS pipeline involved)
 * Declarations come from `tsc -p tsconfig.build.json` (dts: false); the build
 * script wipes lib/ first so no stale files survive.
 */
const neverBundle = [/^@deepseek-ai\//, /^node:/, 'schemastery']

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    sourcemap: true,
    clean: false,
    dts: false,
    fixedExtension: false,
    deps: { neverBundle },
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    clean: false,
    dts: false,
    fixedExtension: false,
    deps: { neverBundle: [...neverBundle, 'react', 'react-dom'] },
  },
])
