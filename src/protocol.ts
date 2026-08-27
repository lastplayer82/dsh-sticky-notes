/**
 * Shared wire protocol between the host half and the browser half of the
 * dsh-sticky-notes plugin. The host persists the note state to a file under
 * $DSH_HOME/.dsh (survives the origin/port changes dsh web makes on restart);
 * the browser keeps the same state in localStorage and restores from the file
 * when its own copy is missing.
 */

/** API path family of the plugin. */
export const STICKY_API = {
  status: '/api/dsh-sticky/status',
  state: '/api/dsh-sticky/state',
} as const

/** One note. `sentAt` is null until the note is delivered into a conversation. */
export interface StickyNotePayload {
  id: string
  text: string
  createdAt: number
  sentAt: number | null
}

/** Whole persisted state (the host file shape). */
export interface StickyStatePayload {
  notes: StickyNotePayload[]
}

/** Health probe response. */
export interface StickyStatusResponse {
  ok: true
  version: string
}
