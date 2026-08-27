/**
 * Wrap the built browser bundle in the dsh client-loader factory format. The
 * web GUI loads every plugin client bundle as a classic script that must call
 * `window.__ModuleLoader__.load({ id, factory })` with a CommonJS-shaped
 * factory (require/module/exports provided by the loader) — the exact shape
 * the captain1275 family buckets ship (dsh-ssh precedent).
 *
 * tsdown emits the CJS bundle as `lib/client.cjs` (package type: module); the
 * dsh loader serves `/plugins/<id>/client.js`, so this script renames the
 * artifact (and fixes its source-map reference) while wrapping it. Run after
 * `tsdown`; the host bundle (lib/index.js) stays plain ESM.
 */
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'

const cjsPath = 'lib/client.cjs'
const mapPath = 'lib/client.cjs.map'
const clientPath = 'lib/client.js'
const pluginId = '@lastplayer82/dsh-sticky-notes'

if (!exists(cjsPath)) {
  console.error(`[dsh-sticky-notes] ${cjsPath} not found — did tsdown emit the client bundle?`)
  process.exit(1)
}

let body = readFileSync(cjsPath, 'utf8')
// Point the source map at its new name and move the comment to the true end.
body = body.split('client.cjs.map').join('client.js.map')
body = body.replace(/\/\/# sourceMappingURL=[^\n]*\n?/g, '')

const wrapped = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(pluginId)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
${body}
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
`

writeFileSync(clientPath, wrapped)
rmSync(cjsPath, { force: true })
if (exists(mapPath)) renameSync(mapPath, 'lib/client.js.map')
console.log(`[dsh-sticky-notes] wrapped ${clientPath} for the client loader (${pluginId})`)

function exists(path) {
  try {
    readFileSync(path)
    return true
  } catch {
    return false
  }
}
