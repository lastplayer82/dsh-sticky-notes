/**
 * Browser-half entry for the dsh-sticky-notes plugin — runs inside the dsh
 * web GUI.
 *
 * Mounts the three surfaces: the sidebar entry row (with the unsent badge),
 * the notes panel in the center column, and the input-dock chip on the
 * official `conversation.input.dock` seat (queue-aware delivery). Failure
 * policy: DOM mounting problems are logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws, and an external plugin
 * must not take the GUI down.
 *
 * Export discipline (packages/client rule): the /client surface carries what
 * cordis loading needs plus types only — all value exports stay internal.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the slots Context merge (ctx.slots) + the locale table.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the conversation slot declaration (conversation.input.dock).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { StickyApi } from './api.ts'
import { StickyController } from './controller.ts'
import { registerStickyDock } from './dock.tsx'
import { setUiLang } from './locales.ts'
import { mountPanel } from './mount.tsx'
import { mountSidebarEntry } from './sidebar-entry.ts'
import { CHANGE_EVENT, StickyStore } from './store.ts'
import { CSS, STICKY_CSS_TAG_ID } from './styles.ts'

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots', 'sessions', 'locale']

/** Type-only surface (export discipline: no value exports beyond the plugin contract). */
export type { StickyPanelProps } from './panel/StickyPanel.tsx'
export type { StickyNote, StickyState } from './store.ts'

/** Inject the embedded stylesheet once (deduplicated by tag id). */
function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STICKY_CSS_TAG_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = '@lastplayer82/dsh-sticky-notes'
  tag.dataset.pluginCss = STICKY_CSS_TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

/**
 * Mount the sticky-notes surfaces.
 * @param ctx - client root context (slots/sessions/locale services injected).
 */
export function apply(ctx: ClientContext): void {
  injectStyles()
  const controller = new StickyController()
  const api = new StickyApi()
  const store = new StickyStore(api)

  // Register the DOM mounts with the fiber lifecycle: HMR reloads / fiber
  // unload must run the disposers, otherwise the surfaces leak across hot
  // reloads (duplicate sidebar buttons / dock chips).
  ctx.effect(() => {
    const disposers: Array<() => void> = []
    try {
      // Follow the DSH locale service (loose read; falls back to document).
      let locale: { getLocale(): { active: string }; subscribe(fn: () => void): () => void } | undefined
      try {
        locale = (ctx as { get(name: string, strict?: boolean): unknown }).get('locale', false) as
          | { getLocale(): { active: string }; subscribe(fn: () => void): () => void }
          | undefined
      } catch {
        locale = undefined
      }
      const syncLang = (): void => {
        try {
          const active = locale?.getLocale().active
          if (active === 'en' || active === 'zh') setUiLang(active)
        } catch {
          // Locale service unavailable: keep the document fallback.
        }
      }
      syncLang()
      if (locale !== undefined) disposers.push(locale.subscribe(syncLang))
      disposers.push(mountSidebarEntry(controller, store))
      disposers.push(mountPanel(controller, store))
      // Slot registration cleanup rides the slots service's fiber lifecycle.
      registerStickyDock(ctx, store, controller)
    } catch (error) {
      // DOM failures degrade the surfaces, never the GUI.
      console.warn('[dsh-sticky-notes] mount failed:', error)
    }
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch (error) {
          console.warn('[dsh-sticky-notes] dispose failed:', error)
        }
      }
    }
  }, 'dsh-sticky-notes: panel mounts')

  // Restore the host-persisted notes when the browser copy is missing (the
  // dsh web port changes on restart, orphaning origin-scoped localStorage).
  void store.load().then(() => {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  })
}
