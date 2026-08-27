/**
 * Sidebar entry injection for the dsh-sticky-notes plugin.
 *
 * dsh's sidebar shell exposes no slot an external plugin can register into,
 * so — following the family-bucket precedent — the entry row is injected as
 * plain DOM (no React tree) between the shell's New Session button and the
 * workspace browser. The injection self-heals: a MutationObserver watches the
 * sidebar root and re-inserts the row whenever a React re-render displaces it
 * (re-insertion happens in the same frame, before paint, so no flicker).
 *
 * The row carries a live badge with the count of unsent notes, refreshed on
 * every store mutation (`dsh-sticky:change`) and on language switches.
 */
import type { StickyController } from './controller.ts'
import { subscribeUiLang, tt } from './locales.ts'
import type { StickyStore } from './store.ts'
import { CHANGE_EVENT, unsentNotes } from './store.ts'

/** Stable data attribute identifying the injected entry row. */
export const ENTRY_SELECTOR = '[data-dsh-sticky-entry]'

/** Inline icon (matches the shell's 16px nav-icon look): a sticky-note glyph. */
const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2.5h10v8l-3.5 3H3z"/><path d="M9.5 13.5v-3H13"/><path d="M6 6h4M6 8.5h2.5"/></svg>'

/** Find the sidebar shell root element, or undefined while not yet mounted. */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

/** Refresh the entry row's copy from the current language and note count. */
function refreshEntry(entry: HTMLButtonElement, store: StickyStore): void {
  const label = entry.querySelector<HTMLElement>('.stk-entryLabel')
  if (label !== null) label.textContent = tt('entry.label')
  entry.setAttribute('aria-label', tt('entry.label'))
  entry.setAttribute('title', tt('entry.tooltip'))
  const badge = entry.querySelector<HTMLElement>('.stk-entryBadge')
  const count = unsentNotes(store.snapshot()).length
  if (badge !== null) {
    badge.textContent = String(count)
    if (count > 0) badge.removeAttribute('hidden')
    else badge.setAttribute('hidden', '')
  }
}

/** Build the entry row (a detached button; insert once the shell is up). */
function createEntry(controller: StickyController, store: StickyStore): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshStickyEntry = ''
  entry.className = 'stk-entry'
  entry.innerHTML = '<span class="stk-entryIcon">' + ICON + '</span><span class="stk-entryLabel"></span><span class="stk-entryBadge" hidden></span>'
  refreshEntry(entry, store)
  entry.addEventListener('click', () => { controller.toggle() })
  return entry
}

/** Re-insert the entry after the whole family block (task board, ssh, tanqi, sticky). */
function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement !== root) {
    const row = button.closest('[class*="logoRow"]')
    const base = (row !== null && row.parentElement === root) ? row : button
    const family = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
        && el.matches('[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-tanqi-entry], [data-dsh-sticky-entry]'),
    )
    const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
    root.insertBefore(entry, anchor)
  }
  return true
}

/**
 * Mount the sidebar entry, waiting for the shell to render and self-healing
 * on later React re-renders.
 * @param controller - the panel controller the entry toggles.
 * @param store - the note store feeding the badge.
 * @returns disposer removing the entry and its observers.
 */
export function mountSidebarEntry(controller: StickyController, store: StickyStore): () => void {
  // Deduplicate: a previous mount may have left stale rows behind (an HMR
  // reload whose disposer never ran — see index.ts apply).
  for (const stale of document.querySelectorAll<HTMLElement>(ENTRY_SELECTOR)) {
    if (stale.parentElement !== null) stale.remove()
  }

  const entry = createEntry(controller, store)
  let root: HTMLElement | undefined
  let placed = false

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry)) return
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) return
    placed = placeEntry(root, entry)
    if (placed) {
      rootObserver.observe(root, { childList: true, subtree: true })
    }
  }

  const waitObserver = new MutationObserver(() => { tryPlace() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) {
      placed = placeEntry(root, entry)
    }
  })

  const syncActive = (): void => {
    if (controller.getSnapshot().panelOpen) entry.dataset.active = 'true'
    else delete entry.dataset.active
  }
  const unsubscribe = controller.subscribe(syncActive)
  syncActive()

  // Refresh the badge on every store mutation and language switch.
  const refresh = (): void => refreshEntry(entry, store)
  const unsubscribeLang = subscribeUiLang(refresh)
  const onChange = (): void => refresh()
  window.addEventListener(CHANGE_EVENT, onChange)

  tryPlace()

  return () => {
    waitObserver.disconnect()
    rootObserver.disconnect()
    unsubscribe()
    unsubscribeLang()
    window.removeEventListener(CHANGE_EVENT, onChange)
    entry.remove()
  }
}
