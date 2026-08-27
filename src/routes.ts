/**
 * The /api/dsh-sticky route family: a status probe and the state-persistence
 * endpoints. Every route carries the same loopback-only trust fence as the
 * other dsh plugins — these endpoints read/write files on the host, so
 * LAN-exposed dsh web deployments must not serve them to strangers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { STICKY_API, type StickyStatePayload } from './protocol.ts'

/** Cap on JSON request bodies (state snapshots are small note lists). */
const MAX_JSON_BODY_BYTES = 512 * 1024

/**
 * State file: the notes, persisted on the HOST side. localStorage is
 * origin-scoped and the dsh web port changes on every restart, which silently
 * orphans browser storage; a file under $DSH_HOME/.dsh survives port changes
 * and is the single source of truth for restore.
 *
 * DATA CONTRACT: this path is version-stable (no version suffix). Upgrades,
 * reinstalls, and restarts must keep reading it — never rename/delete it
 * without migrating (see src/client/store.ts for the full contract).
 */
const STATE_FILE = join(process.env.DSH_HOME ?? homedir(), '.dsh', 'dsh-sticky.json')

/** Read the persisted state file; undefined when absent or corrupt. */
async function readState(): Promise<StickyStatePayload | undefined> {
  try {
    const raw = await readFile(STATE_FILE, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const state = parsed as Partial<StickyStatePayload>
    return Array.isArray(state.notes) ? { notes: state.notes } : undefined
  } catch {
    return undefined
  }
}

/** Write the persisted state file (best-effort, never throws). */
async function writeState(state: StickyStatePayload): Promise<boolean> {
  try {
    await mkdir(dirname(STATE_FILE), { recursive: true })
    await writeFile(STATE_FILE, JSON.stringify(state), 'utf8')
    return true
  } catch {
    return false
  }
}

/** Loopback literal check plus browser same-origin markers (dsh-ssh fence). */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** One JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > maxBytes) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** Guard helper: fence + method check. */
function guard(req: IncomingMessage, res: ServerResponse, method: string): boolean {
  if (!isLoopbackRequest(req)) {
    writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
    return false
  }
  if (req.method !== method) {
    writeJson(res, 405, { ok: false, error: `method not allowed: ${req.method}` })
    return false
  }
  return true
}

/** Build every /api/dsh-sticky route. */
export function makeRoutes(ctx: Context): WebRoute[] {
  return [
    {
      kind: 'exact',
      path: STICKY_API.status,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        writeJson(res, 200, { ok: true, version: '0.2.5' })
      },
    },
    {
      kind: 'exact',
      path: STICKY_API.state,
      handler: async (req, res) => {
        if (req.method === 'GET') {
          const state = await readState()
          writeJson(res, 200, { ok: true, state: state ?? null })
          return
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          const raw = body === undefined ? undefined : body.state
          const shape = raw as Partial<StickyStatePayload> | undefined
          if (shape === undefined || typeof shape !== 'object' || !Array.isArray(shape.notes)) {
            writeJson(res, 400, { ok: false, error: 'invalid state body' })
            return
          }
          const saved = await writeState({ notes: shape.notes })
          writeJson(res, saved ? 200 : 500, { ok: saved })
          return
        }
        writeJson(res, 405, { ok: false, error: `method not allowed: ${req.method}` })
      },
    },
  ]
}
