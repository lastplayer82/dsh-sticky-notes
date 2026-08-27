# dsh-sticky-notes (灵感便签)

> Sticky Notes for the DeepSeek Harness web GUI — jot ideas while the agent is
> thinking, then deliver them into the chat without interrupting it. Fully
> bilingual (zh/en): the UI follows the DSH interface language.

## Features

- **Jot anytime**: capture ideas while the agent thinks/runs — auto-saved on
  every keystroke (browser localStorage + host file dual-write, nothing is
  lost across restarts or port changes).
- **Floating panel** (v0.2): a click on the dock chip / sidebar entry pops a
  floating overlay anchored near the input box (bottom-right when no
  conversation is open); click outside or press ESC to auto-save and close
  (the draft is kept). Draggable by the header, resizable from 8 edges/corners
  — size and position are remembered.
- **Never interrupts the agent**: sends and forwards go through the official
  queue channel (`conversation.send`, mode=queue) — when the target session is
  busy the message lines up and is processed after the running turn.
- **One-click send**: send a single note, or **merge several** into one
  message (verbatim text, blank-line separated, no decoration).
- **Drag to reorder** (v0.2.5): drag the `⋮⋮` handle on any unsent note to
  rearrange the list — **merged sends follow the exact order you see**, so the
  agent receives your ideas in the order you intend.
- **Inline edit** (v0.2.5): click a note's text to edit it in place (the caret
  lands where you clicked); focus leaves → auto-saved; ESC cancels.
- **Copy one note** (v0.2.5): per-note copy button puts the verbatim text on
  the clipboard.
- **Forward to another conversation** (v0.2): 「转到…」opens a session picker
  (busy sessions marked) and forwards through the target session's own queue
  channel.
- **Export** (v0.2.1): tick notes and export as TXT / JSON / Markdown — copy
  or download; TXT is verbatim-only (paste-ready), Markdown decorations follow
  the UI language.
- **Confirmations** (v0.2): destructive actions (clear sent / clear all) use
  an in-panel confirm overlay (window.confirm is unreliable in Electron).
- **Bilingual** (v0.2.2): full zh/en dictionaries, follows the DSH locale
  service automatically.

## Install

```bash
dsh plugin --profile web add <path-to-this-package>
```

Or add `"@lastplayer82/dsh-sticky-notes": "link:../../plugins/dsh-sticky-notes"`
to `profiles/web/package.json` `dependencies` + the package name to
`dsh.profile.bundles`, then `pnpm install` and run `node scripts/junction.mjs`
once. **A full DSH restart is required after install** (a page refresh is not
enough).

## Usage

1. Click the note button above the input box (or the sidebar entry; the badge
   = unsent count) to open the floating panel.
2. Type an idea → 「记下」/ Enter saves and keeps the composer focused
   (Shift+Enter inserts a line break).
3. Send to the current chat: single note 「发送到对话」, or 「合并发送」 to
   merge several (tick to exclude).
4. Send to another chat: 「转到…」→ pick a session → forwarded through its own
   queue channel.
5. Reorder: drag the `⋮⋮` handle (unsent notes only) — merged/forwarded order
   follows the list.
6. Edit: click any note's text, edit, click away (auto-saved), ESC cancels.
7. Sent notes stay in the list marked ✓ and can be cleared (with confirm);
   「清空全部」removes everything (with confirm).

## Data & persistence

- `dsh.sticky.v1` (localStorage) + host file `~/.dsh/dsh-sticky.json` are the
  stable persistence contract — upgrades must never lose notes; the array
  order is the user's display/merge order.
- Uninstalling the plugin does not delete the host file, so reinstalling
  restores notes.

## Architecture

- **Host**: `src/index.ts` + `src/routes.ts` — `/api/dsh-sticky/status`
  (health probe), `/api/dsh-sticky/state` (state file read/write), loopback
  trust fence.
- **Client**: `src/client/` — sidebar entry (self-healing DOM mount), floating
  panel (body-level fixed overlay), input-dock chip registered on the official
  `conversation.input.dock` slot (`conversation.send` for queue delivery).
- **Forwarding**: `ctx.sessions.scope(targetId)` → the target session's scoped
  `conversation.send`; roster read via `ctx.sessions.list` snapshot.
- **Events**: panel ↔ dock over `dsh-sticky:send/-result`,
  `dsh-sticky:list-sessions/-result`, `dsh-sticky:forward/-result`; store
  mutations broadcast `dsh-sticky:change`.

## Build & test

```bash
pnpm install && pnpm build        # build host + client bundle (needs node on PATH)
node scripts/smoke-client.mjs    # client smoke (after build): mount/badge/queue/send/roster/forward/export/copy/edit/reorder
```

---

## 中文速览

DSH 灵感便签插件：AI 思考时随手记想法（自动保存不丢），一键/合并发送或转发到指定会话，全部走官方排队通道、绝不打断 AI；v0.2.5 起支持每条复制、拖拽排序（合并发送顺序跟随清单）、点击文本就地编辑（失焦自动保存）；界面中英双语跟随 DSH 语言设置。安装后需彻底重启 DSH（刷新页面不算）。
