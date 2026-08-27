/**
 * Export helpers for dsh-sticky-notes: turn a selection of notes into TXT,
 * JSON, or Markdown text (pure functions — unit-testable without a browser).
 *
 * TXT — verbatim note text only: each note's original text, blank-line
 *   separated, no numbering/timestamps/status — paste-ready for another chat
 *   (master's requirement: "只要能保证原文，每条重起一行").
 * JSON — full structured payload (id/text/createdAt/sentAt), the machine
 *   format programmers can import/re-process.
 * Markdown — readable document, handy to paste into a chat or a wiki.
 */

import type { StickyNote } from './store.ts'

/** Export formats offered by the panel. */
export type StickyExportFormat = 'txt' | 'json' | 'md'

/** Export document language (Markdown decorations follow the UI language). */
export type ExportLang = 'zh' | 'en'

/** Markdown decorations per language (the note text itself is never touched). */
const MD_LABELS: Record<ExportLang, {
  title: string
  time: string
  count: string
  status: string
  sent: string
  unsent: string
  noTitle: string
}> = {
  zh: { title: '灵感便签导出', time: '时间', count: '条数', status: '状态', sent: '已发送', unsent: '未发送', noTitle: '（无标题）' },
  en: { title: 'Sticky Notes Export', time: 'Time', count: 'Count', status: 'Status', sent: 'Sent', unsent: 'Not sent', noTitle: '(no title)' },
}

/** Local timestamp `YYYY-MM-DD HH:mm`. */
export function formatStamp(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * TXT export: each note's verbatim text only, blank-line separated. No
 * headers, numbering, timestamps, or sent markers — the master uses this to
 * paste straight into another conversation.
 */
export function exportNotesTxt(notes: StickyNote[]): string {
  if (notes.length === 0) return ''
  return notes.map(note => note.text).join('\n\n') + '\n'
}

/** JSON export (full structured payload). */
export function exportNotesJson(notes: StickyNote[]): string {
  return JSON.stringify(notes.map(note => ({
    id: note.id,
    text: note.text,
    createdAt: note.createdAt,
    sentAt: note.sentAt,
  })), null, 2)
}

/** Markdown export (decorations follow the UI language, note text verbatim). */
export function exportNotesMarkdown(notes: StickyNote[], exportedAt = Date.now(), lang: ExportLang = 'zh'): string {
  const labels = MD_LABELS[lang]
  const head = `# ${labels.title}\n\n- ${labels.time}: ${formatStamp(exportedAt)}\n- ${labels.count}: ${notes.length}\n`
  const items = notes.map((note, index) => {
    const status = note.sentAt !== null ? labels.sent : labels.unsent
    return `## ${index + 1}. ${note.text.split('\n')[0] || labels.noTitle}\n\n- ${labels.time}: ${formatStamp(note.createdAt)}\n- ${labels.status}: ${status}\n\n${note.text}\n`
  })
  return `${head}\n${items.join('\n')}`
}

/** Dispatch to the right formatter. */
export function exportNotes(notes: StickyNote[], format: StickyExportFormat, lang: ExportLang = 'zh', exportedAt = Date.now()): string {
  if (format === 'txt') return exportNotesTxt(notes)
  if (format === 'json') return exportNotesJson(notes)
  return exportNotesMarkdown(notes, exportedAt, lang)
}

/** Suggested download filename for one export. */
export function exportFilename(format: StickyExportFormat, exportedAt = Date.now()): string {
  const stamp = formatStamp(exportedAt).replace(/[-: ]/g, '')
  return `sticky-notes-${stamp}.${format === 'md' ? 'md' : format}`
}
