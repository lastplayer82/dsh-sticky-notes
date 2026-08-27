/**
 * Locale dictionaries for the dsh-sticky-notes surfaces. The active language
 * comes from the DSH locale service (synced via {@link setUiLang} by the
 * plugin entry; falls back to document.lang when the service is absent), and
 * every rendered outlet re-renders on language change through
 * {@link subscribeUiLang}.
 */

/** Output language of the plugin UI. */
export type UiLang = 'zh' | 'en'

/** Every copy key of the sticky-notes surface. */
export type StickyKey =
  | 'entry.label'
  | 'entry.tooltip'
  | 'dock.tooltip'
  | 'panel.title'
  | 'panel.subtitle'
  | 'panel.queueLine'
  | 'panel.queueLine.empty'
  | 'panel.empty'
  | 'panel.placeholder'
  | 'panel.add'
  | 'panel.adding'
  | 'panel.send'
  | 'panel.sendAll'
  | 'panel.sendMerged'
  | 'panel.sent'
  | 'panel.delete'
  | 'panel.copy'
  | 'panel.copyTitle'
  | 'panel.copyDone'
  | 'panel.copyFailed'
  | 'panel.dragHint'
  | 'panel.clearSent'
  | 'panel.clearSentConfirm'
  | 'panel.clearAll'
  | 'panel.clearAllConfirm'
  | 'panel.noSession'
  | 'panel.sending'
  | 'panel.forward'
  | 'panel.forwardTitle'
  | 'panel.forwardNoOthers'
  | 'panel.forwardBusy'
  | 'panel.forwarding'
  | 'panel.loadingSessions'
  | 'panel.confirmTitle'
  | 'panel.confirmCancel'
  | 'panel.confirmClear'
  | 'panel.mergeTitle'
  | 'panel.mergeHint'
  | 'panel.mergeEmpty'
  | 'panel.mergeConfirm'
  | 'panel.mergeForward'
  | 'panel.pickerCount'
  | 'export.button'
  | 'export.title'
  | 'export.all'
  | 'export.none'
  | 'export.count'
  | 'export.empty'
  | 'export.copy'
  | 'export.download'
  | 'export.copied'
  | 'export.copyFailed'
  | 'export.downloaded'
  | 'export.hint.txt'
  | 'export.hint.json'
  | 'export.hint.md'
  | 'send.done'
  | 'send.queued'
  | 'send.merged'
  | 'send.error'
  | 'forward.done'
  | 'forward.queued'
  | 'forward.merged'
  | 'forward.noTarget'
  | 'common.close'

/** Chinese dictionary (default). */
export const zh: Record<StickyKey, string> = {
  'entry.label': '灵感便签',
  'entry.tooltip': '灵感便签：AI 思考时随手记想法，一键转为对话消息（Ctrl+Shift+N 呼出）',
  'dock.tooltip': '灵感便签（{n} 条未发送）· Ctrl+Shift+N 呼出',
  'panel.title': '灵感便签',
  'panel.subtitle': '想法随手记，不打断 AI；发送走排队通道，AI 忙时自动排队',
  'panel.queueLine': '本会话有 {n} 条排队消息，AI 完成后自动处理（Ctrl+Enter 可插队）',
  'panel.queueLine.empty': '本会话暂无排队消息',
  'panel.empty': '还没有便签。AI 思考时想到什么，随时记在这里——自动保存，不会丢。',
  'panel.placeholder': '记下想法…（回车保存，Shift+Enter 换行）',
  'panel.add': '记下',
  'panel.adding': '保存中…',
  'panel.send': '发送到对话',
  'panel.sendAll': '发送全部',
  'panel.sendMerged': '合并发送',
  'panel.sent': '已发送',
  'panel.delete': '删除',
  'panel.copy': '复制',
  'panel.copyTitle': '复制本条便签正文',
  'panel.copyDone': '已复制到剪贴板',
  'panel.copyFailed': '复制失败，请重试',
  'panel.dragHint': '拖拽调整顺序（合并发送按此顺序）',
  'panel.clearSent': '清除已发送',
  'panel.clearSentConfirm': '确定清除全部已发送的便签？',
  'panel.clearAll': '清空全部',
  'panel.clearAllConfirm': '确定清空全部便签？此操作不可恢复。',
  'panel.noSession': '请先打开一个会话再发送',
  'panel.sending': '发送中…',
  'panel.forward': '转到…',
  'panel.forwardTitle': '转发到对话',
  'panel.forwardNoOthers': '没有其他会话可转发',
  'panel.forwardBusy': 'AI 运行中',
  'panel.forwarding': '转发中…',
  'panel.loadingSessions': '正在加载会话…',
  'panel.confirmTitle': '确认操作',
  'panel.confirmCancel': '取消',
  'panel.confirmClear': '确认清除',
  'panel.mergeTitle': '合并发送',
  'panel.mergeHint': '勾选要合并的便签，将拼成一条消息发给 AI（默认全选）',
  'panel.mergeEmpty': '请先勾选要发送的便签',
  'panel.mergeConfirm': '合并发送',
  'panel.mergeForward': '转发到对话',
  'panel.pickerCount': '已选 {n} 条便签',
  'export.button': '导出',
  'export.title': '导出便签',
  'export.all': '全选',
  'export.none': '全不选',
  'export.count': '已选 {n} 条',
  'export.empty': '请先勾选要导出的便签',
  'export.copy': '复制',
  'export.download': '下载',
  'export.copied': '已复制到剪贴板',
  'export.copyFailed': '复制失败，请重试',
  'export.downloaded': '已开始下载',
  'export.hint.txt': '纯文本，通用',
  'export.hint.json': '结构化数据，程序可读/可导入',
  'export.hint.md': 'Markdown 文档，可直接粘贴',
  'send.done': '已发送给 AI',
  'send.queued': 'AI 正在处理，消息已排队，完成后自动处理（Ctrl+Enter 可插队）',
  'send.merged': '已合并 {n} 条便签发送',
  'send.error': '发送失败',
  'forward.done': '已转发到「{title}」',
  'forward.queued': '已转发到「{title}」：该会话 AI 正忙，消息已排队待处理',
  'forward.merged': '已合并 {n} 条便签转发到「{title}」',
  'forward.noTarget': '目标会话不可用',
  'common.close': '关闭',
}

/** English dictionary (fallback). */
export const en: Record<StickyKey, string> = {
  'entry.label': 'Sticky Notes',
  'entry.tooltip': 'Sticky Notes: jot ideas while the agent thinks, send them into the chat in one click (Ctrl+Shift+N)',
  'dock.tooltip': 'Sticky Notes ({n} unsent) · Ctrl+Shift+N',
  'panel.title': 'Sticky Notes',
  'panel.subtitle': 'Jot ideas without interrupting the agent; sends go through the queue channel and line up when the agent is busy',
  'panel.queueLine': 'This session has {n} queued messages — processed after the running turn (Ctrl+Enter steers)',
  'panel.queueLine.empty': 'No queued messages in this session',
  'panel.empty': 'No notes yet. Jot anything that comes to mind while the agent is thinking — auto-saved, nothing is lost.',
  'panel.placeholder': 'Jot an idea… (Enter saves, Shift+Enter newline)',
  'panel.add': 'Save',
  'panel.adding': 'Saving…',
  'panel.send': 'Send to chat',
  'panel.sendAll': 'Send all',
  'panel.sendMerged': 'Send merged',
  'panel.sent': 'Sent',
  'panel.delete': 'Delete',
  'panel.copy': 'Copy',
  'panel.copyTitle': 'Copy this note',
  'panel.copyDone': 'Copied to clipboard',
  'panel.copyFailed': 'Copy failed, try again',
  'panel.dragHint': 'Drag to reorder (merged sends follow this order)',
  'panel.clearSent': 'Clear sent',
  'panel.clearSentConfirm': 'Clear all sent notes?',
  'panel.clearAll': 'Clear all',
  'panel.clearAllConfirm': 'Clear all notes? This cannot be undone.',
  'panel.noSession': 'Open a conversation before sending',
  'panel.sending': 'Sending…',
  'panel.forward': 'Forward…',
  'panel.forwardTitle': 'Forward to conversation',
  'panel.forwardNoOthers': 'No other conversations to forward to',
  'panel.forwardBusy': 'agent busy',
  'panel.forwarding': 'Forwarding…',
  'panel.loadingSessions': 'Loading conversations…',
  'panel.confirmTitle': 'Confirm',
  'panel.confirmCancel': 'Cancel',
  'panel.confirmClear': 'Clear',
  'panel.mergeTitle': 'Send merged',
  'panel.mergeHint': 'Tick the notes to combine into one message to the agent (all selected by default)',
  'panel.mergeEmpty': 'Tick at least one note to send',
  'panel.mergeConfirm': 'Send merged',
  'panel.mergeForward': 'Forward…',
  'panel.pickerCount': '{n} notes selected',
  'export.button': 'Export',
  'export.title': 'Export notes',
  'export.all': 'Select all',
  'export.none': 'Select none',
  'export.count': '{n} selected',
  'export.empty': 'Tick at least one note to export',
  'export.copy': 'Copy',
  'export.download': 'Download',
  'export.copied': 'Copied to clipboard',
  'export.copyFailed': 'Copy failed, try again',
  'export.downloaded': 'Download started',
  'export.hint.txt': 'Plain text, universal',
  'export.hint.json': 'Structured data, machine-readable',
  'export.hint.md': 'Markdown document, paste-friendly',
  'send.done': 'Sent to the agent',
  'send.queued': 'Agent is busy — queued, processed after the running turn (Ctrl+Enter steers)',
  'send.merged': 'Merged {n} notes and sent',
  'send.error': 'Send failed',
  'forward.done': 'Forwarded to {title}',
  'forward.queued': 'Forwarded to {title} — agent busy, message queued',
  'forward.merged': 'Merged {n} notes, forwarded to {title}',
  'forward.noTarget': 'Target conversation unavailable',
  'common.close': 'Close',
}

/** Shared active-language state (see plugin entry sync). */
let activeUiLang: UiLang | undefined
const langListeners = new Set<() => void>()

/** Set the panel language from the DSH locale service (notifies subscribers). */
export function setUiLang(lang: UiLang): void {
  if (lang === activeUiLang) return
  activeUiLang = lang
  for (const fn of [...langListeners]) fn()
}

/** Subscribe to language changes; returns an unsubscribe function. */
export function subscribeUiLang(fn: () => void): () => void {
  langListeners.add(fn)
  return () => { langListeners.delete(fn) }
}

/** Current plugin language: DSH-synced value, else document lang, else zh. */
export function currentUiLang(): UiLang {
  if (activeUiLang !== undefined) return activeUiLang
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : ''
  return lang.toLowerCase().startsWith('en') ? 'en' : 'zh'
}

/** Template interpolation for {name} placeholders. */
export function t(dictionary: Record<string, string>, key: string, values?: Record<string, string | number>): string {
  let text = dictionary[key] ?? key
  if (values !== undefined) {
    for (const [name, value] of Object.entries(values)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

/** Active dictionary, picked by the current plugin language. */
export function dictionary(): Record<string, string> {
  return currentUiLang() === 'en' ? { ...en } : { ...zh }
}

/** Translate a key with optional {name} template params (current language). */
export function tt(key: StickyKey, values?: Record<string, string | number>): string {
  return t(dictionary(), key, values)
}
