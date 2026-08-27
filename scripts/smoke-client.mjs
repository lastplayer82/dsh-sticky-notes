/**
 * Client-bundle smoke test: loads the built lib/client.js the way the dsh web
 * GUI does (window.__ModuleLoader__.load with a require-shaped factory) inside
 * jsdom, then invokes the plugin's apply() against a fake client context and
 * asserts the DOM surfaces mount without throwing, the badge reflects seeded
 * notes, and the send event protocol round-trips through the dock chip.
 *
 * Run: node scripts/smoke-client.mjs  (needs `pnpm build` first)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const bundlePath = join(root, 'lib', 'client.js')

const dom = new JSDOM(
  '<!doctype html><html><head></head><body>'
  + '<div data-pane="sidebar"><div class="logoRow"><button class="newSession">New</button></div></div>'
  + '<div data-pane="conversation"></div>'
  + '</body></html>',
  { url: 'http://127.0.0.1:62137/', pretendToBeVisual: true },
)
const { window } = dom
const installGlobal = (name, value) => {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}
installGlobal('window', window)
installGlobal('document', window.document)
installGlobal('navigator', window.navigator)
installGlobal('MutationObserver', window.MutationObserver)
installGlobal('HTMLElement', window.HTMLElement)
installGlobal('Event', window.Event)
installGlobal('CustomEvent', window.CustomEvent)
installGlobal('Node', window.Node)
installGlobal('requestAnimationFrame', (cb) => window.requestAnimationFrame(cb))

// The module loader contract: capture the registration the bundle makes.
let registered = null
window.__ModuleLoader__ = {
  load(entry) {
    registered = entry
  },
}

// Evaluate the bundle as a classic script inside the jsdom realm.
const source = readFileSync(bundlePath, 'utf8')
window.eval(source)

if (registered === null) {
  console.error('FAIL: bundle never called window.__ModuleLoader__.load')
  process.exit(1)
}
if (registered.id !== '@lastplayer82/dsh-sticky-notes') {
  console.error(`FAIL: unexpected plugin id ${registered.id}`)
  process.exit(1)
}

// Provide the external modules the bundle requires (real packages).
const requireShim = (spec) => {
  if (spec === 'react') return require('react')
  if (spec === 'react/jsx-runtime') return require('react/jsx-runtime')
  if (spec === 'react-dom/client') return require('react-dom/client')
  throw new Error(`smoke: unexpected require "${spec}"`)
}
const exports = registered.factory(requireShim)

if (typeof exports.apply !== 'function') {
  console.error('FAIL: factory did not export apply()')
  process.exit(1)
}

// Seed two notes in localStorage before mounting.
const seeded = {
  notes: [
    { id: 'note-a', text: '第一条想法', createdAt: 1787500000000, sentAt: null },
    { id: 'note-b', text: '第二条想法', createdAt: 1787500001000, sentAt: 1787500002000 },
  ],
}
window.localStorage.setItem('dsh.sticky.v1', JSON.stringify(seeded))

// Fake client context: ctx.effect runs its callback synchronously; slots
// registers the dock entry; sessions exposes scope() with a conversation
// service whose send() resolves and input.for() returns a notify spy, plus a
// list snapshot for the forward picker.
const sent = []
const notifyLog = []
const scopeConversation = {
  send: async (text) => { sent.push(text) },
  input: {
    for: () => ({ notify: (level, text) => { notifyLog.push({ level, text }) } }),
  },
}
const sessionListSnapshot = {
  ids: ['session-x', 'session-y'],
  byId: {
    'session-x': { displayTitle: '当前会话', running: true },
    'session-y': { displayTitle: '目标会话', running: false },
  },
}
const slots = {
  inject(name, factory) {
    slots.registered = { name, factory }
    // The real slots service invokes the factory to obtain the registration.
    factory()
    return () => {}
  },
  register(options, component) {
    slots.entry = { options, component }
    return () => {}
  },
}
const ctx = {
  effect(fn) { return fn() },
  get() { return undefined },
  slots,
  sessions: {
    // Mirror the REAL ObservableSnapshot contract (getSnapshot) so the smoke
    // catches API drift — a fake that used `snapshot()` once hid a real bug.
    list: { getSnapshot: () => sessionListSnapshot },
    scope: () => ({
      get: (name) => (name === 'conversation' ? scopeConversation : undefined),
    }),
  },
}
exports.apply(ctx)

// MutationObserver callbacks run on a later tick — let the mounts settle.
await new Promise((resolve) => setTimeout(resolve, 50))

// 1) Sidebar entry + badge shows 1 unsent note.
const entry = window.document.querySelector('[data-dsh-sticky-entry]')
if (entry === null) {
  console.error('FAIL: sidebar entry row not mounted')
  process.exit(1)
}
const badge = entry.querySelector('.stk-entryBadge')
if (badge === null || badge.textContent !== '1' || badge.hasAttribute('hidden')) {
  console.error(`FAIL: sidebar badge expected 1 unsent, got "${badge?.textContent}" hidden=${badge?.hasAttribute('hidden')}`)
  process.exit(1)
}

// 2) Floating panel container mounted as a direct body child (v0.2 popover).
const view = window.document.querySelector('[data-dsh-sticky-view]')
if (view === null) {
  console.error('FAIL: panel overlay container not mounted')
  process.exit(1)
}
if (view.parentElement !== window.document.body) {
  console.error('FAIL: panel overlay must hang off <body> (floating popover), not the conversation column')
  process.exit(1)
}

// 2b) Eight resize handles (4 edges + 4 corners) rendered inside the overlay.
const handles = view.querySelectorAll('.stk-resize')
if (handles.length !== 8) {
  console.error(`FAIL: expected 8 resize handles, got ${handles.length}`)
  process.exit(1)
}

// 2c) Global hotkey (Ctrl+Shift+N) toggles the panel and focuses the composer.
const fireHotkey = () => {
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', {
    key: 'n', code: 'KeyN', ctrlKey: true, shiftKey: true, bubbles: true,
  }))
}
fireHotkey()
await new Promise((resolve) => setTimeout(resolve, 80))
if (!view.classList.contains('stk-viewOpen')) {
  console.error('FAIL: hotkey did not open the panel')
  process.exit(1)
}
const textarea = view.querySelector('.stk-textarea')
if (textarea === null || window.document.activeElement !== textarea) {
  console.error(`FAIL: hotkey did not focus the composer (active=${window.document.activeElement?.className ?? 'none'})`)
  process.exit(1)
}
fireHotkey()
await new Promise((resolve) => setTimeout(resolve, 40))
if (view.classList.contains('stk-viewOpen')) {
  console.error('FAIL: hotkey did not close the panel')
  process.exit(1)
}

// 3) Stylesheet injected.
const style = window.document.querySelector('style[data-plugin-css="@lastplayer82/dsh-sticky-notes/styles.css"]')
if (style === null || style.textContent.length < 1000) {
  console.error('FAIL: embedded stylesheet not injected')
  process.exit(1)
}

// 4) Dock slot registered on conversation.input.dock with order 30.
if (!slots.registered || slots.registered.name !== 'conversation.input.dock') {
  console.error('FAIL: dock slot not registered on conversation.input.dock')
  process.exit(1)
}
const entryOptions = slots.entry.options
if (entryOptions.id !== 'sticky-notes' || entryOptions.order !== 30) {
  console.error(`FAIL: dock entry id/order wrong: ${entryOptions.id}/${entryOptions.order}`)
  process.exit(1)
}

// 5) Render the dock chip through the inject factory with a fake useSession.
const injected = slots.entry.options.inject('session-x')
const dockRoot = window.document.createElement('div')
window.document.body.appendChild(dockRoot)
const React = require('react')
const { createRoot } = require('react-dom/client')
const dockReactRoot = createRoot(dockRoot)
dockReactRoot.render(React.createElement(slots.entry.component, { ...injected, useSession: (sel) => sel({ running: true, queue: [{ id: 'q1' }] }) }))
await new Promise((resolve) => setTimeout(resolve, 50))

const dock = window.document.querySelector('[data-dsh-sticky-dock]')
if (dock === null) {
  console.error('FAIL: dock chip not rendered')
  process.exit(1)
}
const dockBtn = dock.querySelector('button')
if (dockBtn === null) {
  console.error('FAIL: dock chip button not rendered')
  process.exit(1)
}
if (dock.getAttribute('data-queued-count') !== '1') {
  console.error(`FAIL: dock queued-count expected 1, got ${dock.getAttribute('data-queued-count')}`)
  process.exit(1)
}
if (dockBtn.getAttribute('data-busy') === null) {
  console.error('FAIL: dock chip should show busy (running)')
  process.exit(1)
}
if (dockBtn.getAttribute('data-queued') === null) {
  console.error('FAIL: dock chip should show queued state')
  process.exit(1)
}

// 6) Send event protocol: dispatch a send request for the unsent note.
window.dispatchEvent(new window.CustomEvent('dsh-sticky:send', { detail: { noteIds: ['note-a'] } }))
await new Promise((resolve) => setTimeout(resolve, 50))
if (sent.length !== 1 || sent[0] !== '第一条想法') {
  console.error(`FAIL: dock did not deliver the note (sent=${JSON.stringify(sent)})`)
  process.exit(1)
}
if (notifyLog.length === 0) {
  console.error('FAIL: dock did not notify after send')
  process.exit(1)
}
// Note a should now be marked sent (badge drops to 0).
if (badge.textContent !== '0' || !badge.hasAttribute('hidden')) {
  console.error(`FAIL: badge should drop to 0/hidden after send, got "${badge.textContent}"`)
  process.exit(1)
}

// 7) Merged send through the picker UI: 合并发送 opens the picker (both
//    unsent notes ticked by default), confirm sends ONE combined message
//    with no decorative prefix.
injected.store.addNote('想法丙')
injected.store.addNote('想法丁')
await new Promise((resolve) => setTimeout(resolve, 30))
const mergeBtn = [...view.querySelectorAll('.stk-footer button')].find(button => button.textContent === '合并发送')
if (mergeBtn === undefined) {
  console.error('FAIL: merge button not found in footer')
  process.exit(1)
}
mergeBtn.click()
await new Promise((resolve) => setTimeout(resolve, 40))
const mergeList = view.querySelector('.stk-exportList[data-merge]')
if (mergeList === null) {
  console.error('FAIL: merge picker list not rendered')
  process.exit(1)
}
if (mergeList.querySelectorAll('.stk-exportRow').length !== 2) {
  console.error(`FAIL: merge picker should list 2 unsent notes, got ${mergeList.querySelectorAll('.stk-exportRow').length}`)
  process.exit(1)
}
const mergeConfirm = [...view.querySelectorAll('.stk-overlayActions button')].find(button => button.textContent === '合并发送')
if (mergeConfirm === undefined) {
  console.error('FAIL: merge confirm button not found')
  process.exit(1)
}
// The merge picker also offers forwarding the selection to another chat.
const mergeForward = [...view.querySelectorAll('.stk-overlayActions button')].find(button => button.textContent === '转发到对话')
if (mergeForward === undefined) {
  console.error('FAIL: merge picker missing the forward-to-conversation button')
  process.exit(1)
}
mergeConfirm.click()
await new Promise((resolve) => setTimeout(resolve, 50))
if (sent.length !== 2 || !sent[1].includes('想法丙') || !sent[1].includes('想法丁') || sent[1].includes('【灵感】')) {
  console.error(`FAIL: merged send wrong (sent[1]=${JSON.stringify(sent[1])})`)
  process.exit(1)
}

// 8) Session-roster protocol (forward picker): request → answer with rows.
let roster = null
window.addEventListener('dsh-sticky:list-sessions-result', (event) => { roster = event.detail.sessions })
window.dispatchEvent(new window.CustomEvent('dsh-sticky:list-sessions'))
await new Promise((resolve) => setTimeout(resolve, 30))
if (roster === null || roster.length !== 2) {
  console.error(`FAIL: session roster expected 2 rows, got ${JSON.stringify(roster)}`)
  process.exit(1)
}
const current = roster.filter((row) => row.current)
if (current.length !== 1 || current[0].id !== 'session-x') {
  console.error(`FAIL: roster current marker wrong: ${JSON.stringify(current)}`)
  process.exit(1)
}

// 9) Forward protocol: dispatch a forward request, the dock chip must send
//    through the (target) scoped conversation and mark the note sent.
let forwardResult = null
window.addEventListener('dsh-sticky:forward-result', (event) => { forwardResult = event.detail })
const noteE = injected.store.addNote('想法戊')
if (noteE === undefined) {
  console.error('FAIL: addNote for forward test returned undefined')
  process.exit(1)
}
window.dispatchEvent(new window.CustomEvent('dsh-sticky:forward', {
  detail: { noteIds: [noteE.id], targetSessionId: 'session-y' },
}))
await new Promise((resolve) => setTimeout(resolve, 50))
if (forwardResult === null || forwardResult.ok !== true || forwardResult.count !== 1 || forwardResult.title !== '目标会话') {
  console.error(`FAIL: forward result wrong: ${JSON.stringify(forwardResult)}`)
  process.exit(1)
}
if (sent.length !== 3 || sent[2] !== '想法戊') {
  console.error(`FAIL: forward did not deliver the note (sent=${JSON.stringify(sent)})`)
  process.exit(1)
}
// The forwarded note is marked sent → badge drops to 0 again.
if (badge.textContent !== '0' || !badge.hasAttribute('hidden')) {
  console.error(`FAIL: badge should be 0/hidden after forward, got "${badge.textContent}"`)
  process.exit(1)
}

// 10) Export utils: TXT / JSON / Markdown generators produce sane output
//     (pure functions, imported straight from the TS source).
const exportUtils = await import('../src/client/export-utils.ts')
const sampleNotes = [
  { id: 'n1', text: '第一条想法', createdAt: 1787500000000, sentAt: null },
  { id: 'n2', text: '第二条\n换行内容', createdAt: 1787500001000, sentAt: 1787500002000 },
]
const txt = exportUtils.exportNotes(sampleNotes, 'txt')
if (!txt.includes('第一条想法') || !txt.includes('第二条')) {
  console.error(`FAIL: txt export missing content: ${JSON.stringify(txt)}`)
  process.exit(1)
}
// TXT must be verbatim-only: no header/numbering/timestamps (paste-ready).
if (txt.includes('灵感便签导出') || txt.includes('【') || txt.includes('2026-') || txt.includes('✓')) {
  console.error(`FAIL: txt export has decorations: ${JSON.stringify(txt)}`)
  process.exit(1)
}
// Multi-line note text survives verbatim inside the TXT export.
if (!txt.includes('换行内容')) {
  console.error(`FAIL: txt export lost multi-line content: ${JSON.stringify(txt)}`)
  process.exit(1)
}
const json = JSON.parse(exportUtils.exportNotes(sampleNotes, 'json'))
if (json.length !== 2 || json[0].text !== '第一条想法' || json[0].sentAt !== null || json[1].sentAt === null) {
  console.error(`FAIL: json export wrong shape: ${JSON.stringify(json)}`)
  process.exit(1)
}
const md = exportUtils.exportNotes(sampleNotes, 'md')
if (!md.includes('# 灵感便签导出') || !md.includes('第一条想法') || !md.includes('已发送')) {
  console.error(`FAIL: md export missing content: ${JSON.stringify(md.slice(0, 120))}`)
  process.exit(1)
}
// English MD export: decorations follow the UI language (note text verbatim).
const mdEn = exportUtils.exportNotes(sampleNotes, 'md', 'en')
if (!mdEn.includes('# Sticky Notes Export') || !mdEn.includes('Sent') || !mdEn.includes('Not sent')) {
  console.error(`FAIL: english md export wrong: ${JSON.stringify(mdEn.slice(0, 160))}`)
  process.exit(1)
}

// 11) Export overlay UI: the footer Export button opens the picker with
//     every note ticked by default (5 notes exist at this point).
const exportBtn = [...view.querySelectorAll('.stk-footer button')].find(button => button.textContent === '导出')
if (exportBtn === undefined) {
  console.error('FAIL: export button not found in footer')
  process.exit(1)
}
exportBtn.click()
await new Promise((resolve) => setTimeout(resolve, 40))
const exportList = view.querySelector('.stk-exportList')
if (exportList === null) {
  console.error('FAIL: export overlay list not rendered')
  process.exit(1)
}
if (exportList.querySelectorAll('.stk-exportRow').length !== 5) {
  console.error(`FAIL: export overlay should list 5 notes, got ${exportList.querySelectorAll('.stk-exportRow').length}`)
  process.exit(1)
}
const exportCount = view.querySelector('.stk-exportCount')
if (exportCount === null || !exportCount.textContent.includes('5')) {
  console.error(`FAIL: export count should be 5, got "${exportCount?.textContent}"`)
  process.exit(1)
}

// 12) Inline edit: clicking a note's text makes it contentEditable, editing +
//     focusout auto-saves through store.updateNote (click → edit → blur → save).
const noteHe = injected.store.addNote('想法己')
const noteGeng = injected.store.addNote('想法庚')
await new Promise((resolve) => setTimeout(resolve, 40))
// Newest unsent first: [庚, 己, …sent]. Edit the top row (庚).
const firstRow = [...view.querySelectorAll('.stk-note')][0]
const firstTextEl = firstRow.querySelector('.stk-noteText')
if (firstTextEl === null) {
  console.error('FAIL: note text element not rendered')
  process.exit(1)
}
if (firstTextEl.getAttribute('contenteditable') !== 'false') {
  console.error(`FAIL: note text should start non-editable, got contenteditable=${firstTextEl.getAttribute('contenteditable')}`)
  process.exit(1)
}
firstTextEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }))
await new Promise((resolve) => setTimeout(resolve, 60))
if (firstTextEl.getAttribute('contenteditable') !== 'true') {
  console.error('FAIL: clicking a note did not switch it to editable')
  process.exit(1)
}
firstTextEl.textContent = '想法庚-编辑后'
firstTextEl.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }))
await new Promise((resolve) => setTimeout(resolve, 60))
const edited = injected.store.snapshot().notes.find(note => note.id === noteGeng?.id)
if (edited === undefined || edited.text !== '想法庚-编辑后') {
  console.error(`FAIL: inline edit did not save (edited=${JSON.stringify(edited)})`)
  process.exit(1)
}
if (firstTextEl.getAttribute('contenteditable') !== 'false') {
  console.error('FAIL: inline edit should exit edit mode after blur')
  process.exit(1)
}

// 13) Per-note copy button: copies the verbatim text to the clipboard.
const clipboardWrites = []
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: async (text) => { clipboardWrites.push(text) } },
  configurable: true,
})
const copyBtn = [...firstRow.querySelectorAll('.stk-miniBtn')].find(button => button.textContent === '复制')
if (copyBtn === undefined) {
  console.error('FAIL: per-note copy button not rendered')
  process.exit(1)
}
copyBtn.click()
await new Promise((resolve) => setTimeout(resolve, 60))
if (clipboardWrites.length === 0 || clipboardWrites[clipboardWrites.length - 1] !== '想法庚-编辑后') {
  console.error(`FAIL: copy button did not copy the note text (writes=${JSON.stringify(clipboardWrites)})`)
  process.exit(1)
}

// 14) Drag-reorder (store level) + merged-send order follows the list: unsent
//     group is [庚, 己]; moving 庚 below 己 must make merged send emit 己 first.
const unsentBefore = injected.store.snapshot().notes.filter(note => note.sentAt === null).map(note => note.text)
if (unsentBefore[0] !== '想法庚-编辑后' || unsentBefore[1] !== '想法己') {
  console.error(`FAIL: unexpected unsent order after adds: ${JSON.stringify(unsentBefore)}`)
  process.exit(1)
}
if (noteGeng === undefined) {
  console.error('FAIL: addNote returned undefined for the reorder test')
  process.exit(1)
}
injected.store.moveUnsent(noteGeng.id, 1)
await new Promise((resolve) => setTimeout(resolve, 40))
const unsentAfter = injected.store.snapshot().notes.filter(note => note.sentAt === null).map(note => note.text)
if (unsentAfter[0] !== '想法己' || unsentAfter[1] !== '想法庚-编辑后') {
  console.error(`FAIL: moveUnsent did not reorder the unsent group: ${JSON.stringify(unsentAfter)}`)
  process.exit(1)
}
// The merge picker lists the reordered group, and confirming sends the
// combined message in that exact order.
const mergeBtn2 = [...view.querySelectorAll('.stk-footer button')].find(button => button.textContent === '合并发送')
if (mergeBtn2 === undefined) {
  console.error('FAIL: merge button not found for reorder test')
  process.exit(1)
}
mergeBtn2.click()
await new Promise((resolve) => setTimeout(resolve, 40))
const mergeList2 = view.querySelector('.stk-exportList[data-merge]')
if (mergeList2 === null) {
  console.error('FAIL: merge picker not rendered for reorder test')
  process.exit(1)
}
const pickerTexts = [...mergeList2.querySelectorAll('.stk-exportText')].map(el => el.textContent)
if (pickerTexts[0] !== '想法己' || pickerTexts[1] !== '想法庚-编辑后') {
  console.error(`FAIL: merge picker does not follow the dragged order: ${JSON.stringify(pickerTexts)}`)
  process.exit(1)
}
const mergeConfirm2 = [...view.querySelectorAll('.stk-overlayActions button')].find(button => button.textContent === '合并发送')
if (mergeConfirm2 === undefined) {
  console.error('FAIL: merge confirm button not found for reorder test')
  process.exit(1)
}
mergeConfirm2.click()
await new Promise((resolve) => setTimeout(resolve, 60))
const lastSent = sent[sent.length - 1]
if (lastSent !== '想法己\n\n想法庚-编辑后') {
  console.error(`FAIL: merged send does not follow the dragged order: ${JSON.stringify(lastSent)}`)
  process.exit(1)
}

console.log('PASS: client bundle loads, mounts sidebar+floating-panel+dock, badge/queue/send/roster/forward/export/copy/edit/reorder protocols work')
