/**
 * Input-dock chip for the dsh-sticky-notes plugin.
 *
 * Registers a slot entry on the official `conversation.input.dock` seat (the
 * same seat the queue dock / goal bar use — the queue-dock entry in
 * dsh-client-ui-conversation is the pattern). The chip shows the unsent note
 * count, a busy dot while the agent is running (sends will queue), and a
 * queued tint while the session has pending queued messages. Clicking toggles
 * the notes panel (a floating popover since v0.2).
 *
 * Send plumbing: the floating panel lives outside any session scope, so note
 * delivery is delegated here via window events — the panel dispatches
 * `dsh-sticky:send` ({ noteIds? }), this chip (inside the session slot, with
 * the scoped `conversation` service) delivers through `conversation.send`
 * (mode=queue: when the agent is busy the message lines up and runs after the
 * current turn — no interruption), marks the notes sent, notifies, and
 * replies with `dsh-sticky:send-result`.
 *
 * Forward plumbing (v0.2): the panel can also forward a note into a *chosen*
 * conversation. It asks for the session roster via `dsh-sticky:list-sessions`
 * (answered with `dsh-sticky:list-sessions-result`), then dispatches
 * `dsh-sticky:forward` ({ noteIds, targetSessionId }); this chip resolves the
 * target session scope through `ctx.sessions.scope(targetSessionId)` and sends
 * through that session's own `conversation.send` — the same queue-aware
 * official channel, addressed at the target conversation. The result comes
 * back on `dsh-sticky:forward-result`.
 */
import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the conversation slot declaration (conversation.input.dock).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { StickyController } from './controller.ts'
import { tt } from './locales.ts'
import type { StickyNote, StickyStore } from './store.ts'
import { CHANGE_EVENT, unsentNotes } from './store.ts'

/** Stable data attribute on the dock container (the panel probes for it). */
export const DOCK_SELECTOR = '[data-dsh-sticky-dock]'

/** Window event the panel dispatches to request a delivery. */
export const SEND_REQUEST_EVENT = 'dsh-sticky:send'
/** Window event this chip dispatches with the delivery outcome. */
export const SEND_RESULT_EVENT = 'dsh-sticky:send-result'
/** Window event the panel dispatches to request the session roster. */
export const SESSIONS_REQUEST_EVENT = 'dsh-sticky:list-sessions'
/** Window event this chip dispatches with the session roster. */
export const SESSIONS_RESULT_EVENT = 'dsh-sticky:list-sessions-result'
/** Window event the panel dispatches to forward notes into another conversation. */
export const FORWARD_REQUEST_EVENT = 'dsh-sticky:forward'
/** Window event this chip dispatches with the forward outcome. */
export const FORWARD_RESULT_EVENT = 'dsh-sticky:forward-result'

/** Send request detail: omit noteIds to send every unsent note. */
export interface StickySendRequest {
  noteIds?: string[]
}

/** Send result detail. */
export interface StickySendResult {
  ok: boolean
  /** True when the agent was busy and the message was queued instead. */
  queued: boolean
  /** How many notes were delivered. */
  count: number
  error?: string
}

/** One selectable session row for the forward picker. */
export interface StickySessionInfo {
  id: string
  title: string
  running: boolean
  current: boolean
}

/** Session-roster answer. */
export interface StickySessionListResult {
  sessions: StickySessionInfo[]
}

/** Forward request detail. */
export interface StickyForwardRequest {
  noteIds?: string[]
  targetSessionId?: string
}

/** Forward result detail. */
export interface StickyForwardResult {
  ok: boolean
  queued: boolean
  count: number
  /** Target session display title (for the toast). */
  title?: string
  error?: string
}

/** Inline icon: a sticky note with a folded corner. */
const ICON = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2.5h10v8l-3.5 3H3z"/><path d="M9.5 13.5v-3H13"/><path d="M6 6h4M6 8.5h2.5"/></svg>'

/**
 * Merge several notes into one message: each note's verbatim text, blank-line
 * separated (no decorative prefix — the master found "【灵感】" noise). A
 * single note stays verbatim.
 */
function mergeTexts(notes: StickyNote[]): string {
  if (notes.length === 1) return notes[0].text
  return notes.map(note => note.text).join('\n\n')
}

/** Props this chip receives: the slot inject face + framework session hooks. */
interface StickyDockProps {
  store: StickyStore
  controller: StickyController
  /** Scoped conversation send (queue delivery). */
  send: (text: string) => Promise<void>
  /** Session-scoped toast. */
  notify: (level: 'info' | 'error', text: string) => void
  /** Session store hook injected by the slot framework (queue/running). */
  useSession?: <T>(selector: (state: unknown) => T) => T
  /** Roster of every listed session (forward picker). */
  listSessions: () => StickySessionInfo[]
  /** Forward a message into the target session's conversation (queue delivery). */
  forwardTo: (targetSessionId: string, text: string) => Promise<void>
}

/** The dock chip component. */
function StickyDock({ store, controller, send, notify, useSession, listSessions, forwardTo }: StickyDockProps): React.JSX.Element {
  const running = useSession?.((state: unknown) => (state as { running?: boolean }).running ?? false) ?? false
  const queuedCount = useSession?.((state: unknown) => (state as { queue?: readonly unknown[] }).queue?.length ?? 0) ?? 0
  const [unsent, setUnsent] = useState(() => unsentNotes(store.snapshot()).length)

  useEffect(() => {
    const refresh = (): void => setUnsent(unsentNotes(store.snapshot()).length)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => window.removeEventListener(CHANGE_EVENT, refresh)
  }, [store])

  // Deliver notes on panel requests (single or merged; queue-aware).
  useEffect(() => {
    const onSendRequest = async (event: Event): Promise<void> => {
      const detail = (event as CustomEvent<StickySendRequest>).detail ?? {}
      const notes = unsentNotes(store.snapshot())
      const picked = detail.noteIds === undefined
        ? notes
        : notes.filter(note => detail.noteIds?.includes(note.id))
      if (picked.length === 0) {
        window.dispatchEvent(new CustomEvent<StickySendResult>(SEND_RESULT_EVENT, {
          detail: { ok: false, queued: false, count: 0, error: tt('send.error') },
        }))
        return
      }
      const text = mergeTexts(picked)
      try {
        await send(text)
        store.markSent(picked.map(note => note.id))
        const queued = running
        notify('info', picked.length === 1
          ? tt(queued ? 'send.queued' : 'send.done')
          : tt('send.merged', { n: picked.length }))
        window.dispatchEvent(new CustomEvent<StickySendResult>(SEND_RESULT_EVENT, {
          detail: { ok: true, queued, count: picked.length },
        }))
      } catch {
        notify('error', tt('send.error'))
        window.dispatchEvent(new CustomEvent<StickySendResult>(SEND_RESULT_EVENT, {
          detail: { ok: false, queued: false, count: 0, error: tt('send.error') },
        }))
      }
    }
    window.addEventListener(SEND_REQUEST_EVENT, onSendRequest)
    return () => window.removeEventListener(SEND_REQUEST_EVENT, onSendRequest)
  }, [store, send, notify, running])

  // Answer session-roster requests (forward picker).
  useEffect(() => {
    const onListRequest = (): void => {
      window.dispatchEvent(new CustomEvent<StickySessionListResult>(SESSIONS_RESULT_EVENT, {
        detail: { sessions: listSessions() },
      }))
    }
    window.addEventListener(SESSIONS_REQUEST_EVENT, onListRequest)
    return () => window.removeEventListener(SESSIONS_REQUEST_EVENT, onListRequest)
  }, [listSessions])

  // Forward notes into a chosen conversation (scope-addressed, queue-aware).
  useEffect(() => {
    const onForwardRequest = async (event: Event): Promise<void> => {
      const detail = (event as CustomEvent<StickyForwardRequest>).detail ?? {}
      const fail = (error: string): void => {
        window.dispatchEvent(new CustomEvent<StickyForwardResult>(FORWARD_RESULT_EVENT, {
          detail: { ok: false, queued: false, count: 0, error },
        }))
      }
      if (detail.targetSessionId === undefined) {
        fail(tt('forward.noTarget'))
        return
      }
      const notes = unsentNotes(store.snapshot())
      const picked = detail.noteIds === undefined
        ? notes
        : notes.filter(note => detail.noteIds?.includes(note.id))
      if (picked.length === 0) {
        fail(tt('send.error'))
        return
      }
      const target = listSessions().find(session => session.id === detail.targetSessionId)
      if (target === undefined) {
        fail(tt('forward.noTarget'))
        return
      }
      const text = mergeTexts(picked)
      try {
        await forwardTo(target.id, text)
        store.markSent(picked.map(note => note.id))
        const queued = target.running
        notify('info', picked.length === 1
          ? tt(queued ? 'forward.queued' : 'forward.done', { title: target.title })
          : tt('forward.merged', { n: picked.length, title: target.title }))
        window.dispatchEvent(new CustomEvent<StickyForwardResult>(FORWARD_RESULT_EVENT, {
          detail: { ok: true, queued, count: picked.length, title: target.title },
        }))
      } catch {
        notify('error', tt('send.error'))
        window.dispatchEvent(new CustomEvent<StickyForwardResult>(FORWARD_RESULT_EVENT, {
          detail: { ok: false, queued: false, count: 0, error: tt('send.error') },
        }))
      }
    }
    window.addEventListener(FORWARD_REQUEST_EVENT, onForwardRequest)
    return () => window.removeEventListener(FORWARD_REQUEST_EVENT, onForwardRequest)
  }, [store, notify, listSessions, forwardTo])

  return (
    <div className="stk-dock" data-dsh-sticky-dock="" data-queued-count={queuedCount}>
      <button
        type="button"
        className="stk-dockBtn"
        data-busy={running ? '' : undefined}
        data-queued={queuedCount > 0 ? '' : undefined}
        title={tt('dock.tooltip', { n: unsent })}
        onClick={() => { controller.toggle() }}
      >
        <span className="stk-dockIcon" dangerouslySetInnerHTML={{ __html: ICON }} />
        <span className="stk-dockDot" />
        <span className="stk-dockBadge" hidden={unsent === 0}>{unsent}</span>
      </button>
    </div>
  )
}

/**
 * Register the dock chip on the conversation input-dock seat.
 * @param ctx - client root context (slots + sessions services injected).
 * @param store - the note store.
 * @param controller - the panel controller the chip toggles.
 * @returns the registration's disposer (unused: cleanup rides the fiber).
 */
export function registerStickyDock(ctx: ClientContext, store: StickyStore, controller: StickyController): void {
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'sticky-notes',
      order: 30,
      inject: (sessionId) => {
        const actx = ctx.sessions.scope(sessionId)
        if (actx === undefined) throw new Error('sticky dock: session scope unavailable')
        const conversation = actx.get('conversation')
        if (conversation === undefined) throw new Error('sticky dock: conversation service unavailable')
        const shell = conversation.input.for(actx)

        // Roster of every listed session, read from the sessions list store.
        // Tolerates an absent/older list service (degraded picker, never a throw).
        // NOTE: ObservableSnapshot exposes getSnapshot() — `snapshot()` was a
        // real-bug masquerading as safe (the smoke fake mirrored the typo).
        const listSessions = (): StickySessionInfo[] => {
          const sessions = ctx.sessions as unknown as {
            list?: { getSnapshot?: () => { ids?: readonly string[]; byId?: Record<string, { displayTitle?: string; running?: boolean }> } }
          }
          const list = sessions.list?.getSnapshot?.()
          if (list === undefined) return []
          const ids = list.ids ?? []
          const byId = list.byId ?? {}
          return ids.map(id => {
            const row = byId[id]
            return {
              id: String(id),
              title: row?.displayTitle ?? String(id),
              running: row?.running ?? false,
              current: String(id) === String(sessionId),
            }
          })
        }

        // Forward into the target session via its own scoped conversation
        // service (scope-addressed send — same queue channel as this session).
        const forwardTo = async (targetSessionId: string, text: string): Promise<void> => {
          const targetCtx = ctx.sessions.scope(targetSessionId as SessionId)
          if (targetCtx === undefined) throw new Error('sticky forward: target session scope unavailable')
          const targetConversation = targetCtx.get('conversation')
          if (targetConversation === undefined) throw new Error('sticky forward: target conversation unavailable')
          await targetConversation.send(text)
        }

        return {
          store,
          controller,
          send: (text: string) => conversation.send(text),
          notify: (level: 'info' | 'error', text: string) => shell.notify(level, text),
          listSessions,
          forwardTo,
        }
      },
    }, StickyDock))
}
