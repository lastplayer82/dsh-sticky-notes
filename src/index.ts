/**
 * dsh-sticky-notes — host half. Mounts the /api/dsh-sticky route family
 * (status + state persistence), plus a system-prompt announcement so every
 * agent knows the surface exists. The browser half (./client) renders the
 * sidebar entry, the notes panel, and the input-dock chip. Everything rides
 * official NPM SDK packages — no dsh source changes.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { makeRoutes } from './routes.ts'

/** Stable cordis plugin name. */
export const name = 'sticky-notes'

/** Services required before the sticky-notes surfaces can mount. */
export const inject = ['webServer', 'systemPrompt']

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 251

/** Model-facing announcement: plugin presence, capabilities, and limits. */
export const STICKY_GUIDANCE =
  '本机已安装 dsh-sticky-notes 插件（灵感便签）：输入框上方便签快捷按钮（也可从侧边栏「灵感便签」入口打开），点击弹出便签浮层，点浮层外部自动保存并关闭；AI 思考/运行中可随时记下想法（自动保存，localStorage+宿主文件双写，重启不丢）。便签可「发送到对话」（当前会话）或「转到…」转发到指定会话——发送/转发都走排队通道：目标会话 AI 忙碌时消息自动入队、当前轮结束后处理，不打断 AI。清除已发送/清空全部有二次确认。用户提到「灵感便签 / 便签 / 想法记录 / 别打断 / 排队消息 / 转发到对话」时即指本插件，请据此协作。'

/**
 * Mount the routes and the announcement.
 * @param ctx - host plugin context carrying webServer/systemPrompt.
 */
export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'plugin:dsh-sticky-notes',
    order: SECTION_ORDER,
    text: STICKY_GUIDANCE,
  })
  ctx.effect(
    () => {
      const disposers = makeRoutes(ctx).map(route => ctx.webServer.register(route))
      return () => { for (const dispose of disposers) dispose() }
    },
    'dsh-sticky-notes: routes',
  )
}
