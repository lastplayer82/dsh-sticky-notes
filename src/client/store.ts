/**
 * Note persistence for the dsh-sticky-notes plugin.
 *
 * Two layers, both written on every mutation:
 * - localStorage (key `dsh.sticky.v1`): fast read on the current origin.
 * - the host file (~/.dsh/dsh-sticky.json via /api/dsh-sticky/state):
 *   dsh web changes its port on every restart, which silently orphans
 *   origin-scoped browser storage — the host file survives and restores the
 *   notes on the next boot (single source of truth for recovery).
 *
 * Every mutation broadcasts a `dsh-sticky:change` window event so the
 * sidebar badge, the dock chip and the panel all re-render from one place.
 *
 * ── DATA CONTRACT (upgrades must never lose notes) ──
 * STORAGE_KEY (`dsh.sticky.v1`) and the host file path
 * (`$DSH_HOME/.dsh/dsh-sticky.json`) are the stable persistence contract.
 * Future versions MUST keep both stable, or migrate explicitly:
 * - Changing STORAGE_KEY orphans the origin-scoped localStorage copy — the
 *   host file (no version suffix) is the recovery source, so a key change
 *   alone is safe, but read the old key and migrate rather than abandon.
 * - The host file path is stable across versions, restarts, and port changes;
 *   uninstalling the plugin does not delete it, so a reinstall restores notes.
 * - Shape evolution stays backward-compatible: normalizeState tolerates
 *   unknown fields, and notes[] is always read; old versions reading a newer
 *   file keep the notes and only miss new fields.
 */

import type { StickyNotePayload, StickyStatePayload } from '../protocol.ts'
import type { StickyApi } from './api.ts'

/** localStorage key for the whole state. */
export const STORAGE_KEY = 'dsh.sticky.v1'

/** Window event broadcast after every store mutation. */
export const CHANGE_EVENT = 'dsh-sticky:change'

/** One note. `sentAt` is null until delivered into a conversation. */
export interface StickyNote {
  id: string
  text: string
  createdAt: number
  sentAt: number | null
}

/** The whole state. */
export interface StickyState {
  notes: StickyNote[]
}

/** Fresh empty state. */
export function emptyState(): StickyState {
  return { notes: [] }
}

/** Simple client-side id generator. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `sticky-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Normalize one raw note (drops malformed entries). */
function normalizeNote(raw: unknown): StickyNote | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const note = raw as Record<string, unknown>
  const text = typeof note.text === 'string' ? note.text.trim() : ''
  if (text === '') return undefined
  return {
    id: typeof note.id === 'string' && note.id !== '' ? note.id : newId(),
    text,
    createdAt: typeof note.createdAt === 'number' ? note.createdAt : Date.now(),
    sentAt: typeof note.sentAt === 'number' ? note.sentAt : null,
  }
}

/** Normalize a raw persisted state (localStorage or host file). */
export function normalizeState(parsed: unknown): StickyState {
  if (typeof parsed !== 'object' || parsed === null) return emptyState()
  const state = parsed as Partial<StickyState>
  const notes = Array.isArray(state.notes)
    ? state.notes.map(normalizeNote).filter((note): note is StickyNote => note !== undefined)
    : []
  return { notes }
}

/**
 * Cap the state so localStorage stays bounded: every unsent note is kept
 * (they are the user's pending ideas), only the 100 newest sent notes stay.
 * The array shape is [unsent…, sent…] — capping the tail is safe.
 */
export function capState(state: StickyState): StickyState {
  const unsent = state.notes.filter(note => note.sentAt === null)
  const sent = state.notes.filter(note => note.sentAt !== null).slice(-100)
  return { notes: [...unsent, ...sent] }
}

/** Notes still unsent, oldest first. */
export function unsentNotes(state: StickyState): StickyNote[] {
  return state.notes.filter(note => note.sentAt === null)
}

/**
 * The shared store: loads/saves localStorage, mirrors to the host file,
 * and broadcasts {@link CHANGE_EVENT} after every mutation. Best-effort —
 * storage failures degrade to the in-memory copy.
 */
export class StickyStore {
  private memory: StickyState = emptyState()
  private readonly api: StickyApi

  constructor(api: StickyApi) {
    this.api = api
  }

  /** Load the current state (localStorage first, host file as fallback). */
  async load(): Promise<StickyState> {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw !== null) {
        const state = normalizeState(JSON.parse(raw))
        this.memory = state
        return state
      }
    } catch {
      // Fall through to the host file.
    }
    try {
      const host = await this.api.getState()
      if (host !== null) {
        const state = normalizeState(host)
        this.memory = state
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capState(state)))
        } catch {
          // Ignore localStorage quota failures.
        }
        return state
      }
    } catch {
      // Host route unavailable (plugin host half not loaded yet): keep memory.
    }
    return this.memory
  }

  /** The last loaded state (before any async restore settles). */
  snapshot(): StickyState {
    return this.memory
  }

  /** Persist a state (localStorage + host file, both best-effort). */
  save(state: StickyState): void {
    this.memory = state
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capState(state)))
    } catch {
      // Quota/private-mode failures degrade to the in-memory copy.
    }
    // Mirror to the host file (fire-and-forget; failures are logged away).
    this.api.saveState(state).catch(() => {
      // Host persistence is best-effort — never block the UI on it.
    })
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  }

  /**
   * Add one note (trimmed, non-empty); returns the added note or undefined.
   * New notes land at the TOP of the unsent group (newest first — the display
   * order before any drag-reorder), so the array stays [unsent…, sent…].
   */
  addNote(text: string): StickyNote | undefined {
    const trimmed = text.trim()
    if (trimmed === '') return undefined
    const note: StickyNote = { id: newId(), text: trimmed, createdAt: Date.now(), sentAt: null }
    const unsent = this.memory.notes.filter(item => item.sentAt === null)
    const sent = this.memory.notes.filter(item => item.sentAt !== null)
    this.save({ notes: [note, ...unsent, ...sent] })
    return note
  }

  /**
   * Update a note's text in place (trimmed; an empty text keeps the old one —
   * the inline editor cancels instead of deleting). Every mutation re-saves
   * and broadcasts, so the panel re-renders the new text.
   */
  updateNote(id: string, text: string): void {
    const trimmed = text.trim()
    if (trimmed === '') return
    this.save({
      notes: this.memory.notes.map(note => note.id === id ? { ...note, text: trimmed } : note),
    })
  }

  /**
   * Move an unsent note within the unsent group (drag-reorder). `targetIndex`
   * is the 0-based position inside the unsent sequence; the sent tail keeps
   * its relative order. The merged-send order follows automatically, because
   * the dock builds merged messages from unsentNotes() in array order.
   */
  moveUnsent(id: string, targetIndex: number): void {
    const note = this.memory.notes.find(item => item.id === id)
    if (note === undefined || note.sentAt !== null) return
    const unsent = this.memory.notes.filter(item => item.sentAt === null)
    const current = unsent.findIndex(item => item.id === id)
    if (current === -1) return
    const target = Math.max(0, Math.min(unsent.length - 1, Math.trunc(targetIndex)))
    if (target === current) return
    const [moved] = unsent.splice(current, 1)
    unsent.splice(target, 0, moved)
    const sent = this.memory.notes.filter(item => item.sentAt !== null)
    this.save({ notes: [...unsent, ...sent] })
  }

  /** Remove one note by id. */
  removeNote(id: string): void {
    this.save({ notes: this.memory.notes.filter(note => note.id !== id) })
  }

  /** Mark notes as sent (records sentAt, keeps them in the list). */
  markSent(ids: string[]): void {
    const wanted = new Set(ids)
    if (wanted.size === 0) return
    const now = Date.now()
    this.save({
      notes: this.memory.notes.map(note => wanted.has(note.id) && note.sentAt === null ? { ...note, sentAt: now } : note),
    })
  }

  /** Drop every sent note. */
  clearSent(): void {
    this.save({ notes: this.memory.notes.filter(note => note.sentAt === null) })
  }

  /** Drop every note. */
  clearAll(): void {
    this.save(emptyState())
  }
}
