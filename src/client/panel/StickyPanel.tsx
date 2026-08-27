/**
 * The notes panel for dsh-sticky-notes (floating popover, v0.2): composer +
 * note list + delivery + forward-to-conversation.
 *
 * Delivery is delegated to the input-dock chip through window events (the
 * panel lives outside any session scope; the chip owns the scoped
 * `conversation` service). Sending checks the chip is present (a conversation
 * must be open), dispatches `dsh-sticky:send`, and reflects
 * `dsh-sticky:send-result`. When the agent is busy the chip queues the
 * message (conversation.send, mode=queue) — the panel shows the queued hint.
 *
 * Forwarding (v0.2): each note can be sent into a *chosen* conversation. The
 * panel requests the session roster (`dsh-sticky:list-sessions` →
 * `dsh-sticky:list-sessions-result`), renders a picker, and forwards through
 * `dsh-sticky:forward` → `dsh-sticky:forward-result`.
 *
 * Destructive actions ("clear sent" / "clear all") no longer use
 * window.confirm (which does not reliably surface inside the Electron shell):
 * they open an in-panel confirm overlay with explicit cancel/confirm buttons.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DOCK_SELECTOR,
  FORWARD_REQUEST_EVENT,
  FORWARD_RESULT_EVENT,
  SEND_REQUEST_EVENT,
  SEND_RESULT_EVENT,
  SESSIONS_REQUEST_EVENT,
  SESSIONS_RESULT_EVENT,
  type StickyForwardResult,
  type StickySendResult,
  type StickySessionInfo,
  type StickySessionListResult,
} from '../dock.tsx'
import { tt, currentUiLang } from '../locales.ts'
import { exportFilename, exportNotes, type StickyExportFormat } from '../export-utils.ts'
import type { StickyController } from '../controller.ts'
import type { StickyNote, StickyState, StickyStore } from '../store.ts'
import { CHANGE_EVENT, unsentNotes } from '../store.ts'

/** Props of the panel view. */
export interface StickyPanelProps {
  controller: StickyController
  store: StickyStore
}

/**
 * Window event the hotkey handler dispatches after opening the panel, asking
 * the composer to take focus (the overlay becomes visible before this fires).
 */
export const FOCUS_INPUT_EVENT = 'dsh-sticky:focus-input'

/** Which destructive action is awaiting confirmation. */
type ConfirmKind = 'clearSent' | 'clearAll'

/** localStorage key remembering the user-resized panel size. */
const PANEL_SIZE_KEY = 'dsh.sticky.panelSize.v1'

/** Resize handle directions (cardinals + corners). */
const RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

/** Minimum popover size (matches the CSS min-width/min-height). */
const MIN_W = 300
const MIN_H = 220

/** Short local timestamp (HH:MM, today) or date. */
function shortTime(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}

/** Copy text to the clipboard (navigator API, with the execCommand fallback). */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for restricted clipboard: hidden textarea + execCommand.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

/**
 * One note row: drag handle (unsent only) + inline-editable text (click to
 * edit, blur to save) + meta + actions (send / copy / forward / delete).
 */
function NoteRow({ note, store, dockPresent, sending, unsentIndex, onSend, onForward, onCopy, onMove }: {
  note: StickyNote
  store: StickyStore
  dockPresent: boolean
  sending: boolean
  /** Position inside the unsent group (-1 when the note is sent). */
  unsentIndex: number
  onSend: (note: StickyNote) => void
  onForward: (note: StickyNote) => void
  onCopy: (note: StickyNote) => Promise<void>
  onMove: (id: string, targetUnsentIndex: number) => void
}): React.JSX.Element {
  const sent = note.sentAt !== null
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)
  const [overBefore, setOverBefore] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)
  const dragIdRef = useRef<string | null>(null)

  // Click a note's text to edit in place: focus and put the caret where the
  // user clicked (contentEditable keeps the caret where you click naturally).
  const startEdit = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (editing) return
    setEditing(true)
    requestAnimationFrame(() => {
      const el = textRef.current
      if (el === null) return
      el.focus()
      const selection = window.getSelection()
      if (selection === null) return
      selection.removeAllRanges()
      const at = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
        .caretRangeFromPoint?.(event.clientX, event.clientY)
      const range = at ?? document.createRange()
      if (at === undefined || at === null) {
        range.selectNodeContents(el)
        range.collapse(true)
      }
      selection.addRange(range)
    })
  }

  // Save on blur (auto-save when focus leaves the note).
  const commitEdit = (): void => {
    const next = textRef.current?.textContent ?? note.text
    if (next.trim() !== '' && next.trim() !== note.text) store.updateNote(note.id, next)
    setEditing(false)
  }

  // Escape cancels the edit and restores the original text.
  const cancelEdit = (): void => {
    if (textRef.current !== null) textRef.current.textContent = note.text
    setEditing(false)
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>): void => {
    dragIdRef.current = note.id
    event.dataTransfer.setData('text/plain', note.id)
    event.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }
  const handleDragEnd = (): void => {
    setDragging(false)
    setOver(false)
    dragIdRef.current = null
  }
  // Only the unsent group accepts drops; dropping before/after a row's
  // vertical middle inserts the dragged note at that position in the group.
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    if (sent) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    setOver(true)
    setOverBefore(event.clientY < rect.top + rect.height / 2)
  }
  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    if (sent) return
    event.preventDefault()
    const draggedId = dragIdRef.current ?? event.dataTransfer.getData('text/plain')
    const rect = event.currentTarget.getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    onMove(draggedId, unsentIndex + (before ? 0 : 1))
    setOver(false)
    setDragging(false)
    dragIdRef.current = null
  }

  return (
    <div
      className={`stk-note${sent ? ' stk-noteSent' : ''}${dragging ? ' stk-dragging' : ''}${over ? (overBefore ? ' stk-overBefore' : ' stk-overAfter') : ''}`}
      data-sent={sent || undefined}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={() => { setOver(false) }}
    >
      <div className="stk-noteTop">
        {!sent && (
          <div
            className="stk-dragHandle"
            draggable
            title={tt('panel.dragHint')}
            aria-label={tt('panel.dragHint')}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            ⋮⋮
          </div>
        )}
        <div
          ref={textRef}
          className="stk-noteText"
          contentEditable={editing}
          suppressContentEditableWarning
          onClick={startEdit}
          onBlur={commitEdit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelEdit()
            }
          }}
        >
          {note.text}
        </div>
      </div>
      <div className="stk-noteMeta">
        <span>{shortTime(note.createdAt)}</span>
        {sent && <span className="stk-noteSent">✓ {tt('panel.sent')}</span>}
        <div className="stk-noteActions">
          {!sent && (
            <button
              type="button"
              className="stk-miniBtn"
              disabled={!dockPresent || sending}
              onClick={() => { onSend(note) }}
            >
              {tt('panel.send')}
            </button>
          )}
          <button
            type="button"
            className="stk-miniBtn"
            disabled={sending}
            onClick={() => { onForward(note) }}
            title={tt('panel.forwardTitle')}
          >
            {tt('panel.forward')}
          </button>
          <button
            type="button"
            className="stk-miniBtn"
            disabled={sending}
            onClick={() => { void onCopy(note) }}
            title={tt('panel.copyTitle')}
          >
            {tt('panel.copy')}
          </button>
          <button
            type="button"
            className="stk-miniBtn"
            data-danger=""
            onClick={() => { store.removeNote(note.id) }}
          >
            {tt('panel.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The panel. */
export function StickyPanel({ controller, store }: StickyPanelProps): React.JSX.Element {
  const [state, setState] = useState<StickyState>(() => store.snapshot())
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [dockPresent, setDockPresent] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  // In-panel confirm overlay (replaces window.confirm, which is unreliable in
  // the Electron shell).
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)
  // Forward-to-conversation picker (note ids: 1 = per-note, several = merged).
  const [pickerIds, setPickerIds] = useState<string[] | null>(null)
  const [pickerSessions, setPickerSessions] = useState<StickySessionInfo[] | null>(null)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [forwarding, setForwarding] = useState(false)
  const pickerTimeout = useRef<number | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Export overlay: pick notes (checkbox list) + format (txt/json/md).
  const [exportOpen, setExportOpen] = useState(false)
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set())
  const [exportFormat, setExportFormat] = useState<StickyExportFormat>('txt')
  // Merge-send overlay: tick which unsent notes go out as one message.
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set())

  const showToast = (text: string, kind: 'ok' | 'error'): void => {
    setToast({ text, kind })
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }

  // Restore the user-resized panel size (remembered across sessions).
  useEffect(() => {
    const view = document.querySelector<HTMLElement>('[data-dsh-sticky-view]')
    if (view === null) return
    try {
      const raw = window.localStorage.getItem(PANEL_SIZE_KEY)
      if (raw !== null) {
        const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown }
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          view.style.width = `${Math.max(MIN_W, Math.min(window.innerWidth - 32, parsed.width))}px`
          view.style.height = `${Math.max(MIN_H, Math.min(window.innerHeight - 32, parsed.height))}px`
        }
      }
    } catch {
      // Ignore corrupt entries.
    }
  }, [])

  // Focus the composer when the hotkey asked the panel to open (the overlay
  // is visible by then — focus waits one frame to be safe).
  useEffect(() => {
    const onFocusRequest = (): void => {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    window.addEventListener(FOCUS_INPUT_EVENT, onFocusRequest)
    return () => window.removeEventListener(FOCUS_INPUT_EVENT, onFocusRequest)
  }, [])

  // Drag a resize handle to resize the popover (edges + corners, clamped to
  // the viewport; the final size is persisted).
  const startResize = (dir: string, event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const view = (event.currentTarget as HTMLElement).closest<HTMLElement>('.stk-view')
    if (view === null) return
    const startX = event.clientX
    const startY = event.clientY
    const rect = view.getBoundingClientRect()
    const start = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    const onMove = (move: PointerEvent): void => {
      const dx = move.clientX - startX
      const dy = move.clientY - startY
      let left = start.left
      let top = start.top
      let width = start.width
      let height = start.height
      if (dir.includes('e')) width = start.width + dx
      if (dir.includes('s')) height = start.height + dy
      if (dir.includes('w')) width = start.width - dx
      if (dir.includes('n')) height = start.height - dy
      width = Math.min(window.innerWidth - 32, Math.max(MIN_W, width))
      height = Math.min(window.innerHeight - 32, Math.max(MIN_H, height))
      if (dir.includes('w')) left = start.left + (start.width - width)
      if (dir.includes('n')) top = start.top + (start.height - height)
      view.style.width = `${Math.round(width)}px`
      view.style.height = `${Math.round(height)}px`
      view.style.left = `${Math.round(left)}px`
      view.style.top = `${Math.round(top)}px`
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        const r = view.getBoundingClientRect()
        window.localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify({ width: Math.round(r.width), height: Math.round(r.height) }))
      } catch {
        // Persist is best-effort.
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Live store + dock state (the dock chip owns the session-scoped queue count).
  useEffect(() => {
    const refresh = (): void => setState(store.snapshot())
    const syncDock = (): void => {
      const el = document.querySelector<HTMLElement>(DOCK_SELECTOR)
      setDockPresent(el !== null)
      setQueuedCount(el === null ? 0 : Number(el.getAttribute('data-queued-count') ?? 0) || 0)
    }
    const onMutation = (): void => { syncDock() }
    syncDock()
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener(CHANGE_EVENT, syncDock)
    const observer = new MutationObserver(onMutation)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-queued-count'] })
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener(CHANGE_EVENT, syncDock)
      observer.disconnect()
    }
  }, [store])

  // Delivery + forward + roster result feedback.
  useEffect(() => {
    const onSendResult = (event: Event): void => {
      const result = (event as CustomEvent<StickySendResult>).detail
      setSending(false)
      if (result.ok) {
        showToast(result.queued ? tt('send.queued') : (result.count > 1 ? tt('send.merged', { n: result.count }) : tt('send.done')), 'ok')
      } else {
        showToast(result.error ?? tt('send.error'), 'error')
      }
    }
    const onForwardResult = (event: Event): void => {
      const result = (event as CustomEvent<StickyForwardResult>).detail
      setForwarding(false)
      setPickerIds(null)
      setPickerSessions(null)
      if (pickerTimeout.current !== undefined) window.clearTimeout(pickerTimeout.current)
      if (result.ok) {
        showToast(result.queued
          ? tt('forward.queued', { title: result.title ?? '' })
          : (result.count > 1 ? tt('forward.merged', { n: result.count, title: result.title ?? '' }) : tt('forward.done', { title: result.title ?? '' })),
        'ok')
      } else {
        showToast(result.error ?? tt('send.error'), 'error')
      }
    }
    const onSessionList = (event: Event): void => {
      const result = (event as CustomEvent<StickySessionListResult>).detail
      if (pickerTimeout.current !== undefined) window.clearTimeout(pickerTimeout.current)
      setPickerLoading(false)
      setPickerSessions(result.sessions ?? [])
    }
    window.addEventListener(SEND_RESULT_EVENT, onSendResult)
    window.addEventListener(FORWARD_RESULT_EVENT, onForwardResult)
    window.addEventListener(SESSIONS_RESULT_EVENT, onSessionList)
    return () => {
      window.removeEventListener(SEND_RESULT_EVENT, onSendResult)
      window.removeEventListener(FORWARD_RESULT_EVENT, onForwardResult)
      window.removeEventListener(SESSIONS_RESULT_EVENT, onSessionList)
    }
  }, [])

  const notes = state.notes
  const unsent = useMemo(() => unsentNotes(state), [state])
  // Display order = storage order, grouped unsent-first. Dragging reorders the
  // unsent group and merged sends follow the very same order (unsentNotes is
  // array order), so what the master sees is what the agent receives.
  const sorted = useMemo(() => {
    const sent = notes.filter(note => note.sentAt !== null)
    return [...unsent, ...sent]
  }, [notes, unsent])
  const sentCount = notes.length - unsent.length

  const addNote = (): void => {
    store.addNote(draft)
    setDraft('')
    // Keep typing: the composer stays focused after saving, so the next idea
    // can be entered immediately (Enter or the Save button both land here).
    textareaRef.current?.focus()
  }

  const requestSend = (noteIds?: string[]): void => {
    if (!dockPresent) {
      showToast(tt('panel.noSession'), 'error')
      return
    }
    setSending(true)
    window.dispatchEvent(new CustomEvent(SEND_REQUEST_EVENT, { detail: { noteIds } }))
  }

  // Merge-send picker: choose which unsent notes go out as one message
  // (defaults to all of them; tick to exclude some).
  const openMerge = (): void => {
    if (unsent.length === 0) return
    setMergeSelected(new Set(unsent.map(note => note.id)))
    setMergeOpen(true)
  }

  const confirmMerge = (): void => {
    const ids = [...mergeSelected]
    if (ids.length === 0) {
      showToast(tt('panel.mergeEmpty'), 'error')
      return
    }
    setMergeOpen(false)
    requestSend(ids)
  }

  // Export overlay: default to every note selected, format defaults to txt.
  const openExport = (): void => {
    if (notes.length === 0) return
    setExportSelected(new Set(sorted.map(note => note.id)))
    setExportFormat('txt')
    setExportOpen(true)
  }

  /** Notes currently ticked in the export overlay (in display order). */
  const exportPicked = (): StickyNote[] => sorted.filter(note => exportSelected.has(note.id))

  const copyExport = async (): Promise<void> => {
    const picked = exportPicked()
    if (picked.length === 0) {
      showToast(tt('export.empty'), 'error')
      return
    }
    const text = exportNotes(picked, exportFormat, currentUiLang())
    if (await copyTextToClipboard(text)) showToast(tt('export.copied'), 'ok')
    else showToast(tt('export.copyFailed'), 'error')
  }

  /** Copy one note's verbatim text (per-note copy button). */
  const copyNote = async (note: StickyNote): Promise<void> => {
    if (await copyTextToClipboard(note.text)) showToast(tt('panel.copyDone'), 'ok')
    else showToast(tt('panel.copyFailed'), 'error')
  }

  const downloadExport = (): void => {
    const picked = exportPicked()
    if (picked.length === 0) {
      showToast(tt('export.empty'), 'error')
      return
    }
    const text = exportNotes(picked, exportFormat, currentUiLang())
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = exportFilename(exportFormat)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(tt('export.downloaded'), 'ok')
  }

  const openPicker = (noteIds: string[]): void => {
    if (noteIds.length === 0) return
    setPickerIds(noteIds)
    setPickerSessions(null)
    setPickerLoading(true)
    window.dispatchEvent(new CustomEvent(SESSIONS_REQUEST_EVENT))
    // No dock (no conversation open) or a dead roster: bail out of the
    // loading state so the picker can show its empty message.
    if (pickerTimeout.current !== undefined) window.clearTimeout(pickerTimeout.current)
    pickerTimeout.current = window.setTimeout(() => setPickerLoading(false), 1500)
  }

  const closePicker = (): void => {
    if (forwarding) return
    if (pickerTimeout.current !== undefined) window.clearTimeout(pickerTimeout.current)
    setPickerIds(null)
    setPickerSessions(null)
    setPickerLoading(false)
  }

  const pickerTargets = useMemo(() => (pickerSessions ?? []).filter(session => !session.current), [pickerSessions])

  // The notes being forwarded (1 for a per-note forward, several for a
  // merged forward) — used for the picker's preview line.
  const pickerNotes = useMemo(() => {
    if (pickerIds === null) return []
    return pickerIds.map(id => sorted.find(note => note.id === id)).filter((note): note is StickyNote => note !== undefined)
  }, [pickerIds, sorted])

  const forwardNote = (target: StickySessionInfo): void => {
    if (pickerIds === null || pickerIds.length === 0) return
    setForwarding(true)
    window.dispatchEvent(new CustomEvent(FORWARD_REQUEST_EVENT, {
      detail: { noteIds: pickerIds, targetSessionId: target.id },
    }))
  }

  // Forward the merge-picker selection to a chosen conversation instead of
  // sending it into the current one.
  const forwardMerged = (): void => {
    const ids = [...mergeSelected]
    if (ids.length === 0) {
      showToast(tt('panel.mergeEmpty'), 'error')
      return
    }
    setMergeOpen(false)
    openPicker(ids)
  }

  const clearSent = (): void => {
    if (sentCount === 0) return
    setConfirm('clearSent')
  }

  const clearAll = (): void => {
    if (notes.length === 0) return
    setConfirm('clearAll')
  }

  const runConfirm = (): void => {
    if (confirm === 'clearSent') store.clearSent()
    if (confirm === 'clearAll') store.clearAll()
    setConfirm(null)
  }

  const confirmText = confirm === 'clearSent' ? tt('panel.clearSentConfirm') : tt('panel.clearAllConfirm')

  return (
    <>
      <div className="stk-panel">
      <div className="stk-header">
        <div className="stk-headerRow">
          <div>
            <h2 className="stk-title">{tt('panel.title')}</h2>
            <p className="stk-subtitle">{tt('panel.subtitle')}</p>
          </div>
          <button type="button" className="stk-closeBtn" onClick={() => { controller.close() }} title={tt('common.close')} aria-label={tt('common.close')}>
            ×
          </button>
        </div>
      </div>

      {queuedCount > 0 && (
        <div className="stk-queueLine">{tt('panel.queueLine', { n: queuedCount })}</div>
      )}

      <div className="stk-composer">
        <textarea
          ref={textareaRef}
          className="stk-textarea"
          value={draft}
          placeholder={tt('panel.placeholder')}
          onChange={(event) => { setDraft(event.currentTarget.value) }}
          onKeyDown={(event) => {
            // Enter saves the note and keeps focus for the next one;
            // Shift+Enter inserts a line break inside the note.
            if (event.key === 'Enter' && !event.shiftKey) {
              if (draft.trim() === '') return
              event.preventDefault()
              addNote()
            }
          }}
        />
        <div className="stk-addRow">
          <button
            type="button"
            className="stk-btn stk-btnPrimary"
            disabled={draft.trim() === ''}
            onClick={addNote}
          >
            {tt('panel.add')}
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="stk-empty">{tt('panel.empty')}</div>
      ) : (
        <div className="stk-list">
          {sorted.map(note => {
            const unsentIndex = note.sentAt === null
              ? unsent.findIndex(item => item.id === note.id)
              : -1
            return (
              <NoteRow
                key={note.id}
                note={note}
                store={store}
                dockPresent={dockPresent}
                sending={sending || forwarding}
                unsentIndex={unsentIndex}
                onSend={(target) => { requestSend([target.id]) }}
                onForward={(note) => { openPicker([note.id]) }}
                onCopy={copyNote}
                onMove={(id, target) => { store.moveUnsent(id, target) }}
              />
            )
          })}
        </div>
      )}

      <div className="stk-footer">
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="stk-btn"
            disabled={unsent.length === 0 || sending || forwarding}
            onClick={openMerge}
            title={tt('panel.mergeHint')}
          >
            {tt('panel.sendMerged')}
          </button>
          <button
            type="button"
            className="stk-btn"
            disabled={notes.length === 0}
            onClick={openExport}
          >
            {tt('export.button')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="stk-btn" disabled={sentCount === 0} onClick={clearSent}>
            {tt('panel.clearSent')}
          </button>
          <button type="button" className="stk-btn" disabled={notes.length === 0} onClick={clearAll}>
            {tt('panel.clearAll')}
          </button>
        </div>
      </div>

      {/* Export overlay: tick notes, pick a format, copy or download. */}
      {exportOpen && (
        <div className="stk-overlay" onClick={() => { setExportOpen(false) }}>
          <div className="stk-overlayBox" onClick={(event) => { event.stopPropagation() }}>
            <div className="stk-overlayTitle">{tt('export.title')}</div>
            <div className="stk-exportToolbar">
              <button type="button" className="stk-miniBtn" onClick={() => { setExportSelected(new Set(sorted.map(note => note.id))) }}>
                {tt('export.all')}
              </button>
              <button type="button" className="stk-miniBtn" onClick={() => { setExportSelected(new Set()) }}>
                {tt('export.none')}
              </button>
              <span className="stk-exportCount">{tt('export.count', { n: exportSelected.size })}</span>
            </div>
            <div className="stk-exportList">
              {sorted.map(note => (
                <label key={note.id} className="stk-exportRow">
                  <input
                    type="checkbox"
                    checked={exportSelected.has(note.id)}
                    onChange={(event) => {
                      const next = new Set(exportSelected)
                      if (event.currentTarget.checked) next.add(note.id)
                      else next.delete(note.id)
                      setExportSelected(next)
                    }}
                  />
                  <span className="stk-exportText">{note.text.split('\n')[0] || ' '}</span>
                  <span className="stk-exportTime">{shortTime(note.createdAt)}</span>
                </label>
              ))}
            </div>
            <div className="stk-exportFormats">
              {(['txt', 'json', 'md'] as const).map(format => (
                <button
                  key={format}
                  type="button"
                  className={`stk-btn stk-exportFormat${exportFormat === format ? ' stk-exportFormatActive' : ''}`}
                  onClick={() => { setExportFormat(format) }}
                  title={tt(`export.hint.${format}`)}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="stk-overlayActions">
              <button type="button" className="stk-btn" onClick={() => { setExportOpen(false) }}>
                {tt('panel.confirmCancel')}
              </button>
              <button type="button" className="stk-btn" onClick={downloadExport}>
                {tt('export.download')}
              </button>
              <button type="button" className="stk-btn stk-btnPrimary" onClick={copyExport}>
                {tt('export.copy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge-send overlay: tick which unsent notes go out as one message. */}
      {mergeOpen && (
        <div className="stk-overlay" onClick={() => { setMergeOpen(false) }}>
          <div className="stk-overlayBox" onClick={(event) => { event.stopPropagation() }}>
            <div className="stk-overlayTitle">{tt('panel.mergeTitle')}</div>
            <div className="stk-overlayText">{tt('panel.mergeHint')}</div>
            <div className="stk-exportToolbar">
              <button type="button" className="stk-miniBtn" onClick={() => { setMergeSelected(new Set(unsent.map(note => note.id))) }}>
                {tt('export.all')}
              </button>
              <button type="button" className="stk-miniBtn" onClick={() => { setMergeSelected(new Set()) }}>
                {tt('export.none')}
              </button>
              <span className="stk-exportCount">{tt('export.count', { n: mergeSelected.size })}</span>
            </div>
            <div className="stk-exportList" data-merge="">
              {unsent.map(note => (
                <label key={note.id} className="stk-exportRow">
                  <input
                    type="checkbox"
                    checked={mergeSelected.has(note.id)}
                    onChange={(event) => {
                      const next = new Set(mergeSelected)
                      if (event.currentTarget.checked) next.add(note.id)
                      else next.delete(note.id)
                      setMergeSelected(next)
                    }}
                  />
                  <span className="stk-exportText">{note.text.split('\n')[0] || ' '}</span>
                  <span className="stk-exportTime">{shortTime(note.createdAt)}</span>
                </label>
              ))}
            </div>
            <div className="stk-overlayActions">
              <button type="button" className="stk-btn" onClick={() => { setMergeOpen(false) }}>
                {tt('panel.confirmCancel')}
              </button>
              <button type="button" className="stk-btn" onClick={forwardMerged}>
                {tt('panel.mergeForward')}
              </button>
              <button type="button" className="stk-btn stk-btnPrimary" onClick={confirmMerge}>
                {tt('panel.mergeConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm overlay: replaces window.confirm (unreliable in Electron). */}
      {confirm !== null && (
        <div className="stk-overlay" data-confirm="" onClick={() => { setConfirm(null) }}>
          <div className="stk-overlayBox" onClick={(event) => { event.stopPropagation() }}>
            <div className="stk-overlayTitle">{tt('panel.confirmTitle')}</div>
            <div className="stk-overlayText">{confirmText}</div>
            <div className="stk-overlayActions">
              <button type="button" className="stk-btn" onClick={() => { setConfirm(null) }}>
                {tt('panel.confirmCancel')}
              </button>
              <button type="button" className="stk-btn stk-btnDanger" onClick={runConfirm} autoFocus>
                {tt('panel.confirmClear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward picker: choose a conversation to forward the note(s) into. */}
      {pickerIds !== null && (
        <div className="stk-overlay" onClick={closePicker}>
          <div className="stk-overlayBox" onClick={(event) => { event.stopPropagation() }}>
            <div className="stk-overlayTitle">{tt('panel.forwardTitle')}</div>
            <div className="stk-overlayText stk-overlayNote">
              {pickerNotes.length === 1 ? `「${pickerNotes[0].text}」` : tt('panel.pickerCount', { n: pickerNotes.length })}
            </div>
            <div className="stk-sessionList">
              {pickerLoading && pickerSessions === null && (
                <div className="stk-sessionEmpty">{tt('panel.loadingSessions')}</div>
              )}
              {!pickerLoading && pickerSessions !== null && pickerTargets.length === 0 && (
                <div className="stk-sessionEmpty">{tt('panel.forwardNoOthers')}</div>
              )}
              {pickerTargets.map(session => (
                <button
                  key={session.id}
                  type="button"
                  className="stk-sessionRow"
                  disabled={forwarding}
                  onClick={() => { forwardNote(session) }}
                >
                  <span className="stk-sessionTitle">{session.title}</span>
                  {session.running && <span className="stk-sessionBusy">{tt('panel.forwardBusy')}</span>}
                </button>
              ))}
              {pickerTargets.length > 0 && forwarding && (
                <div className="stk-sessionEmpty">{tt('panel.forwarding')}</div>
              )}
            </div>
            <div className="stk-overlayActions">
              <button type="button" className="stk-btn" disabled={forwarding} onClick={closePicker}>
                {tt('panel.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast !== null && <div className="stk-toast" data-show="">{toast.text}</div>}
      </div>

      {/* Resize handles: drag an edge or corner to resize the popover. */}
      {RESIZE_DIRS.map(dir => (
        <div
          key={dir}
          className="stk-resize"
          data-dir={dir}
          onPointerDown={(event) => { startResize(dir, event) }}
        />
      ))}
    </>
  )
}
