/**
 * Embedded stylesheet for the dsh-sticky-notes surfaces (sidebar entry, panel,
 * input-dock chip). The client loader serves no separate CSS asset — the
 * stylesheet is injected as a <style> tag (dsh-ssh precedent). Class names are
 * prefixed `stk-` to stay collision-free.
 *
 * COLOR POLICY (v0.2.2): every surface uses plugin-owned `--stk-*` variables
 * defined here, with a light default and a `prefers-color-scheme: dark`
 * override. DSH theme variables (`--dsw-*`) are NOT used — they may or may not
 * exist depending on the shell build, and a mixed fallback produced
 * white-on-white popovers (master's "看不到字" report). Self-contained tokens
 * guarantee readable contrast in any theme.
 */

/** Stable tag id for the injected stylesheet (deduplicated by the entry). */
export const STICKY_CSS_TAG_ID = '@lastplayer82/dsh-sticky-notes/styles.css'

/** The full stylesheet text. */
export const CSS = `
/* ── palette (plugin-owned, light default + dark override) ──────── */
:root {
  --stk-bg: #ffffff;
  --stk-bg2: #ffffff;
  --stk-text: #1e293b;
  --stk-text2: #475569;
  --stk-text3: #94a3b8;
  --stk-border: rgba(15,23,42,0.14);
  --stk-border-soft: rgba(15,23,42,0.08);
  --stk-hover: rgba(15,23,42,0.05);
  --stk-accent: #2563eb;
  --stk-accent-hover: #1d4ed8;
  --stk-accent-soft: #dbeafe;
  --stk-danger: #dc2626;
  --stk-danger-hover: #b91c1c;
  --stk-danger-soft: rgba(220,38,38,0.12);
  --stk-success: #16a34a;
  --stk-warn: #b45309;
  --stk-warn-soft: rgba(217,119,6,0.14);
  --stk-mask: rgba(15,23,42,0.35);
  --stk-shadow: 0 12px 40px rgba(0,0,0,0.18);
  --stk-shadow-2: 0 8px 24px rgba(0,0,0,0.16);
}
@media (prefers-color-scheme: dark) {
  :root {
    --stk-bg: #1e293b;
    --stk-bg2: #0f172a;
    --stk-text: #f1f5f9;
    --stk-text2: #cbd5e1;
    --stk-text3: #94a3b8;
    --stk-border: rgba(226,232,240,0.18);
    --stk-border-soft: rgba(226,232,240,0.10);
    --stk-hover: rgba(226,232,240,0.08);
    --stk-accent: #3b82f6;
    --stk-accent-hover: #60a5fa;
    --stk-accent-soft: rgba(59,130,246,0.22);
    --stk-danger: #f87171;
    --stk-danger-hover: #ef4444;
    --stk-danger-soft: rgba(239,68,68,0.16);
    --stk-success: #4ade80;
    --stk-warn: #fbbf24;
    --stk-warn-soft: rgba(251,191,36,0.16);
    --stk-mask: rgba(0,0,0,0.55);
    --stk-shadow: 0 12px 40px rgba(0,0,0,0.45);
    --stk-shadow-2: 0 8px 24px rgba(0,0,0,0.4);
  }
}

/* ── sidebar entry ─────────────────────────────────────────────── */
.stk-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 4px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--stk-text2);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  text-align: left;
}
.stk-entry:hover { background: var(--stk-hover); color: var(--stk-text); }
.stk-entry[data-active] { background: var(--stk-hover); color: var(--stk-text); }
.stk-entryIcon { display: inline-flex; flex: none; width: 16px; height: 16px; align-items: center; justify-content: center; }
.stk-entryIcon svg { width: 14px; height: 14px; }
.stk-entryLabel { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stk-entryBadge {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--stk-accent-soft);
  color: var(--stk-accent);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}
.stk-entryBadge[hidden] { display: none; }

/* ── input-dock chip ───────────────────────────────────────────── */
.stk-dock { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.stk-dockBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 2px 10px;
  border: 1px solid var(--stk-border);
  border-radius: 13px;
  background: var(--stk-hover);
  color: var(--stk-text2);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
}
.stk-dockBtn:hover { background: var(--stk-hover); color: var(--stk-text); }
.stk-dockBtn[data-busy] .stk-dockDot { background: var(--stk-accent); box-shadow: 0 0 0 3px var(--stk-accent-soft); }
.stk-dockBtn[data-queued] { border-color: var(--stk-warn); color: var(--stk-warn); }
.stk-dockIcon { display: inline-flex; flex: none; }
.stk-dockIcon svg { width: 13px; height: 13px; }
.stk-dockDot { width: 6px; height: 6px; border-radius: 50%; background: transparent; transition: background 0.15s ease; }
.stk-dockBadge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--stk-accent-soft);
  color: var(--stk-accent);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}
.stk-dockBadge[hidden] { display: none; }

/* ── floating panel (v0.2 popover) ────────────────────────────── */
.stk-view {
  position: fixed;
  z-index: 3000;
  display: none;
  width: 396px;
  height: min(65vh, 640px);
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  min-width: 300px;
  min-height: 220px;
  background: var(--stk-bg);
  border: 1px solid var(--stk-border);
  border-radius: 16px;
  box-shadow: var(--stk-shadow);
}
.stk-viewOpen { display: flex; }
/* ── resize handles (drag an edge/corner to resize the popover) ── */
.stk-resize {
  position: absolute;
  z-index: 20;
  touch-action: none;
}
.stk-resize[data-dir="n"] { top: -3px; left: 12px; right: 12px; height: 7px; cursor: ns-resize; }
.stk-resize[data-dir="s"] { bottom: -3px; left: 12px; right: 12px; height: 7px; cursor: ns-resize; }
.stk-resize[data-dir="e"] { right: -3px; top: 12px; bottom: 12px; width: 7px; cursor: ew-resize; }
.stk-resize[data-dir="w"] { left: -3px; top: 12px; bottom: 12px; width: 7px; cursor: ew-resize; }
.stk-resize[data-dir="ne"] { top: -4px; right: -4px; width: 15px; height: 15px; cursor: nesw-resize; }
.stk-resize[data-dir="nw"] { top: -4px; left: -4px; width: 15px; height: 15px; cursor: nwse-resize; }
.stk-resize[data-dir="se"] { bottom: -4px; right: -4px; width: 15px; height: 15px; cursor: nwse-resize; }
.stk-resize[data-dir="sw"] { bottom: -4px; left: -4px; width: 15px; height: 15px; cursor: nesw-resize; }
.stk-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 15px;
}
.stk-header { display: flex; flex-direction: column; gap: 4px; }
.stk-headerRow { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.stk-headerRow > div { min-width: 0; }
.stk-title { font-size: 16px; font-weight: 600; line-height: 24px; color: var(--stk-text); margin: 0; }
.stk-subtitle { font-size: 12px; line-height: 18px; color: var(--stk-text3); margin: 0; }
.stk-closeBtn {
  flex: none;
  width: 26px;
  height: 26px;
  margin: -2px -4px 0 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--stk-text3);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.stk-closeBtn:hover { background: var(--stk-hover); color: var(--stk-text); }
.stk-queueLine {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--stk-warn-soft);
  color: var(--stk-warn);
  font-size: 12px;
  line-height: 18px;
}
.stk-queueLine[data-empty] { background: var(--stk-hover); color: var(--stk-text3); }
.stk-composer { display: flex; flex-direction: column; gap: 8px; }
.stk-textarea {
  width: 100%;
  min-height: 64px;
  max-height: 160px;
  padding: 9px 11px;
  border: 1px solid var(--stk-border);
  border-radius: 12px;
  background: var(--stk-bg2);
  color: var(--stk-text);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  resize: vertical;
  box-sizing: border-box;
  outline: none;
}
.stk-textarea:focus { border-color: var(--stk-accent); }
.stk-textarea::placeholder { color: var(--stk-text3); }
.stk-addRow { display: flex; justify-content: flex-end; }
.stk-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 14px;
  border: 1px solid var(--stk-border);
  border-radius: 15px;
  background: var(--stk-hover);
  color: var(--stk-text);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
}
.stk-btn:hover { background: var(--stk-hover); }
.stk-btn:disabled { opacity: 0.45; cursor: default; }
.stk-btnPrimary {
  background: var(--stk-accent);
  border-color: transparent;
  color: #ffffff;
}
.stk-btnPrimary:hover { background: var(--stk-accent-hover); }
.stk-btnDanger {
  background: var(--stk-danger);
  border-color: transparent;
  color: #ffffff;
}
.stk-btnDanger:hover { background: var(--stk-danger-hover); }
.stk-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px; margin: 0 -2px; }
.stk-empty { padding: 24px 12px; text-align: center; color: var(--stk-text3); font-size: 13px; line-height: 20px; }
.stk-note {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 11px;
  border: 1px solid var(--stk-border-soft);
  border-radius: 12px;
  background: var(--stk-bg2);
}
.stk-note[data-sent] { opacity: 0.62; }
.stk-noteTop { display: flex; align-items: flex-start; gap: 6px; }
.stk-dragHandle {
  flex: none;
  margin: 1px -2px 0 0;
  padding: 0 3px;
  color: var(--stk-text3);
  font-size: 11px;
  line-height: 18px;
  letter-spacing: -1px;
  cursor: grab;
  user-select: none;
  border-radius: 6px;
}
.stk-dragHandle:hover { background: var(--stk-hover); color: var(--stk-text2); }
.stk-dragHandle:active { cursor: grabbing; }
.stk-noteText { flex: 1 1 auto; min-width: 0; font-size: 13px; line-height: 20px; color: var(--stk-text); white-space: pre-wrap; word-break: break-word; }
.stk-noteText[contenteditable="true"] {
  cursor: text;
  outline: 1px solid var(--stk-accent);
  border-radius: 6px;
  padding: 2px 5px;
  margin: -2px -5px;
  background: var(--stk-bg);
}
.stk-note.stk-dragging { opacity: 0.4; }
.stk-note.stk-overBefore { border-top: 2px solid var(--stk-accent); }
.stk-note.stk-overAfter { border-bottom: 2px solid var(--stk-accent); }
.stk-noteMeta { display: flex; align-items: center; gap: 8px; font-size: 11px; line-height: 16px; color: var(--stk-text3); }
.stk-noteSent { color: var(--stk-success); }
.stk-noteActions { display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }
.stk-miniBtn {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 1px 8px;
  border: 1px solid var(--stk-border-soft);
  border-radius: 11px;
  background: transparent;
  color: var(--stk-text2);
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  cursor: pointer;
}
.stk-miniBtn:hover { background: var(--stk-hover); color: var(--stk-text); }
.stk-miniBtn:disabled { opacity: 0.45; cursor: default; }
.stk-miniBtn[data-danger]:hover { background: var(--stk-danger-soft); color: var(--stk-danger); }
.stk-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid var(--stk-border-soft); }

/* ── in-panel overlays: confirm + forward picker ──────────────── */
.stk-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--stk-mask);
  border-radius: 16px;
  padding: 16px;
  box-sizing: border-box;
}
.stk-overlayBox {
  width: 100%;
  max-width: 320px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: var(--stk-bg);
  border: 1px solid var(--stk-border);
  border-radius: 14px;
  box-shadow: var(--stk-shadow-2);
  box-sizing: border-box;
}
.stk-overlayTitle { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--stk-text); }
.stk-overlayText { font-size: 13px; line-height: 20px; color: var(--stk-text2); word-break: break-word; }
.stk-overlayNote {
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--stk-hover);
  color: var(--stk-text);
}
.stk-overlayActions { display: flex; justify-content: flex-end; gap: 8px; }
.stk-sessionList {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.stk-sessionRow {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 4px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--stk-text);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  text-align: left;
}
.stk-sessionRow:hover { background: var(--stk-hover); }
.stk-sessionRow:disabled { opacity: 0.5; cursor: default; }
.stk-sessionTitle { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stk-sessionBusy {
  flex: none;
  padding: 0 6px;
  border-radius: 7px;
  background: var(--stk-warn-soft);
  color: var(--stk-warn);
  font-size: 10px;
  line-height: 16px;
}
.stk-sessionEmpty { padding: 12px 8px; text-align: center; color: var(--stk-text3); font-size: 12px; line-height: 18px; }

/* ── export overlay ───────────────────────────────────────────── */
.stk-exportToolbar { display: flex; align-items: center; gap: 6px; }
.stk-exportCount { margin-left: auto; font-size: 12px; line-height: 18px; color: var(--stk-text3); }
.stk-exportList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--stk-border-soft);
  border-radius: 10px;
  padding: 4px;
}
.stk-exportRow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
}
.stk-exportRow:hover { background: var(--stk-hover); }
.stk-exportRow input { flex: none; accent-color: var(--stk-accent); }
.stk-exportText {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 18px;
  color: var(--stk-text);
}
.stk-exportTime { flex: none; font-size: 11px; line-height: 16px; color: var(--stk-text3); }
.stk-exportFormats { display: flex; gap: 6px; }
.stk-exportFormat { flex: 1 1 0; justify-content: center; }
.stk-exportFormatActive {
  background: var(--stk-accent);
  border-color: transparent;
  color: #ffffff;
}
.stk-exportFormatActive:hover { background: var(--stk-accent-hover); }

/* ── toast (fixed to the viewport, above everything) ─────────── */
.stk-toast {
  position: fixed;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: 480px;
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--stk-text);
  color: var(--stk-bg);
  font-size: 13px;
  line-height: 20px;
  box-shadow: var(--stk-shadow-2);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.stk-toast[data-show] { opacity: 1; }
`
