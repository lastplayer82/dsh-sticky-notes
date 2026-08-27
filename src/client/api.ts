/**
 * Browser-side API client for the /api/dsh-sticky route family. Plain fetch,
 * same origin — the only host-data access path the plugin uses.
 */

import { STICKY_API, type StickyStatePayload, type StickyStatusResponse } from '../protocol.ts'

/** Error carrying the route's JSON error message. */
export class StickyApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StickyApiError'
  }
}

/** Parse a JSON response or throw a StickyApiError. */
async function readJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new StickyApiError(`HTTP ${response.status}: invalid JSON response`)
  }
  const failed = body as { ok?: unknown; error?: unknown }
  if (!response.ok || failed.ok === false) {
    throw new StickyApiError(typeof failed.error === 'string' ? failed.error : `HTTP ${response.status}`)
  }
  return body as T
}

/** The browser half's host-data entry point. */
export class StickyApi {
  /** Probe the host half (health check). */
  async status(): Promise<StickyStatusResponse> {
    const response = await fetch(STICKY_API.status)
    return readJson<StickyStatusResponse>(response)
  }

  /** Pull the host-side persisted state (undefined when none was saved yet). */
  async getState(): Promise<StickyStatePayload | null> {
    const response = await fetch(STICKY_API.state)
    const body = await readJson<{ ok: true; state: StickyStatePayload | null }>(response)
    return body.state
  }

  /** Persist the state on the host (survives browser origin changes). */
  async saveState(state: StickyStatePayload): Promise<void> {
    const response = await fetch(STICKY_API.state, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state }),
    })
    await readJson<{ ok: true }>(response)
  }
}
