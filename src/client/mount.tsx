/**
 * Floating-panel mounting for dsh-sticky-notes (v0.2: panel-as-popover).
 *
 * v0.1 took over the center conversation column (html-level data attribute +
 * sibling-panel eviction) — the master's review found it too invasive. v0.2
 * mounts the panel as a body-level floating overlay (position: fixed) that
 * opens from the dock chip / sidebar entry, anchors near the dock button when
 * a conversation is open (fallback: bottom-right corner), auto-saves on
 * outside clicks (notes are already persisted on every keystroke by the
 * store — "save" here means close-without-losing-draft, so the React root
 * stays mounted and only the overlay hides), and closes on ESC / outside
 * pointerdown.
 *
 * No conversation-column takeover, no sibling-panel eviction, no html
 * attributes: the popover floats above whatever the center column shows.
 */
import { createRoot, type Root } from 'react-dom/client'
import type { StickyController } from './controller.ts'
import type { StickyStore } from './store.ts'
import { FOCUS_INPUT_EVENT, StickyPanel } from './panel/StickyPanel.tsx'
import { DOCK_SELECTOR } from './dock.tsx'
import { tt } from './locales.ts'

/** The injected overlay container (kept in the DOM, hidden when inactive). */
export const PANEL_VIEW_SELECTOR = '[data-dsh-sticky-view]'

/** Sidebar entry row (a click there toggles the panel, so it must not close it). */
const ENTRY_SELECTOR = '[data-dsh-sticky-entry]'

const OVERLAY_Z_INDEX = 3000
const EDGE_MARGIN = 16
const ANCHOR_GAP = 10
/** Resize guard: repositions only when actually resized (avoids fighting layout thrash). */
let lastViewportWidth = 0

/** The dock chip rect, when a conversation (and thus the dock) is on screen. */
function anchorRect(): DOMRect | undefined {
  const dock = document.querySelector<HTMLElement>(DOCK_SELECTOR)
  if (dock === null || !dock.isConnected) return undefined
  const rect = dock.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return undefined
  return rect
}

/** localStorage key remembering where the user dragged the panel. */
const PANEL_POS_KEY = 'dsh.sticky.panelPos.v1'

/** The saved user position, clamped into the viewport (undefined = none). */
function savedPosition(): { left: number; top: number } | undefined {
  try {
    const raw = window.localStorage.getItem(PANEL_POS_KEY)
    if (raw === null) return undefined
    const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown }
    if (typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return undefined
    const maxLeft = Math.max(EDGE_MARGIN, window.innerWidth - 60)
    const maxTop = Math.max(EDGE_MARGIN, window.innerHeight - 40)
    return {
      left: Math.min(maxLeft, Math.max(EDGE_MARGIN, parsed.left)),
      top: Math.min(maxTop, Math.max(EDGE_MARGIN, parsed.top)),
    }
  } catch {
    return undefined
  }
}

/**
 * Position the overlay: the user-dragged position wins (clamped into the
 * viewport); otherwise right-aligned above the dock chip when available,
 * else the bottom-right corner. Re-runs after fonts/layout settle.
 */
function positionOverlay(overlay: HTMLElement): void {
  const width = overlay.offsetWidth
  const height = overlay.offsetHeight
  const viewport = window.innerWidth
  const vh = window.innerHeight
  const saved = savedPosition()

  let left: number
  let top: number
  if (saved !== undefined) {
    left = saved.left
    top = saved.top
  } else if (anchorRect() !== undefined) {
    // Right edge aligns with the dock chip; the panel floats just above it.
    const anchor = anchorRect()!
    left = anchor.right - width
    if (left < EDGE_MARGIN) left = EDGE_MARGIN
    top = anchor.top - height - ANCHOR_GAP
    if (top < EDGE_MARGIN) top = anchor.bottom + ANCHOR_GAP
  } else {
    left = Math.max(EDGE_MARGIN, viewport - width - EDGE_MARGIN)
    top = Math.max(EDGE_MARGIN, vh - height - EDGE_MARGIN - 72)
  }
  overlay.style.left = `${Math.round(left)}px`
  overlay.style.top = `${Math.round(top)}px`
}

/**
 * Mount the panel React tree into a body-level floating overlay and bind its
 * visibility to the controller's panelOpen state.
 * @param controller - the panel controller driving the overlay.
 * @param store - the note store the panel edits.
 * @returns disposer unmounting the tree and removing the overlay.
 */
export function mountPanel(controller: StickyController, store: StickyStore): () => void {
  let root: Root | undefined
  let overlay: HTMLDivElement | undefined

  const ensure = (): void => {
    if (overlay !== undefined) {
      if (overlay.isConnected) return
      root?.unmount()
      root = undefined
      overlay.remove()
      overlay = undefined
    }
    overlay = document.createElement('div')
    overlay.dataset.dshStickyView = ''
    overlay.className = 'stk-view'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-label', tt('panel.title'))
    document.body.appendChild(overlay)
    overlay.addEventListener('pointerdown', onOverlayPointerDown)
    root = createRoot(overlay)
    root.render(<StickyPanel controller={controller} store={store} />)
  }

  // The panel overlays the whole window; watch for a late body swap.
  const waitObserver = new MutationObserver(() => { ensure() })
  waitObserver.observe(document.body, { childList: true, subtree: false })

  const applyActive = (): void => {
    const view = overlay
    if (view === undefined) return
    if (controller.getSnapshot().panelOpen) {
      view.classList.add('stk-viewOpen')
      // Position after the browser lays the overlay out (next frame) and
      // again after fonts settle; cheap and idempotent.
      requestAnimationFrame(() => positionOverlay(view))
      window.setTimeout(() => positionOverlay(view), 60)
    } else {
      view.classList.remove('stk-viewOpen')
    }
  }

  // Outside-pointerdown closes the popover (auto-save is a no-op: the store
  // persists on every mutation, and the hidden React root keeps the draft).
  // Capture phase so it fires before any inner handler could stop it.
  const onPointerDown = (event: PointerEvent): void => {
    if (!controller.getSnapshot().panelOpen) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    if (overlay !== undefined && target.closest(PANEL_VIEW_SELECTOR) !== null) return
    if (target.closest(DOCK_SELECTOR) !== null) return
    if (target.closest(ENTRY_SELECTOR) !== null) return
    controller.close()
  }

  // Drag the popover by its header row (pointer-down on the title area).
  // The position is clamped into the viewport and persisted, so the panel
  // reopens where the user left it (positionOverlay honors the saved spot).
  const onOverlayPointerDown = (event: PointerEvent): void => {
    const view = overlay
    if (view === undefined) return
    if (!controller.getSnapshot().panelOpen) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    if (target.closest('.stk-headerRow') === null) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const rect = view.getBoundingClientRect()
    const start = { left: rect.left, top: rect.top }
    const onMove = (move: PointerEvent): void => {
      const left = Math.max(8, Math.min(window.innerWidth - 60, start.left + move.clientX - startX))
      const top = Math.max(8, Math.min(window.innerHeight - 40, start.top + move.clientY - startY))
      view.style.left = `${Math.round(left)}px`
      view.style.top = `${Math.round(top)}px`
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        const r = view.getBoundingClientRect()
        window.localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }))
      } catch {
        // Persist is best-effort.
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && controller.getSnapshot().panelOpen) controller.close()
  }

  // Global hotkey: Ctrl+Shift+N toggles the popover (one press opens with the
  // composer focused, next press closes). Capture phase, page-wide.
  const onHotkey = (event: KeyboardEvent): void => {
    if (!event.ctrlKey || !event.shiftKey || event.code !== 'KeyN') return
    event.preventDefault()
    controller.toggle()
    if (controller.getSnapshot().panelOpen) {
      window.dispatchEvent(new CustomEvent(FOCUS_INPUT_EVENT))
    }
  }

  const onResize = (): void => {
    const width = window.innerWidth
    if (width === lastViewportWidth) return
    lastViewportWidth = width
    if (controller.getSnapshot().panelOpen && overlay !== undefined) positionOverlay(overlay)
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('keydown', onHotkey, true)
  window.addEventListener('resize', onResize)
  const unsubscribe = controller.subscribe(applyActive)
  applyActive()
  ensure()

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('keydown', onHotkey, true)
    window.removeEventListener('resize', onResize)
    waitObserver.disconnect()
    unsubscribe()
    root?.unmount()
    root = undefined
    overlay?.remove()
    overlay = undefined
  }
}
