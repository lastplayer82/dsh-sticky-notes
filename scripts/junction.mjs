// 重打 dsh-sticky-notes 的 junction（方法8）：插件自带 node_modules 的
// @deepseek-ai / schemastery 会遮蔽宿主 rc.5 全家桶 → 换成 junction 指向
// profiles 依赖闭包，防双版本风险。pnpm install 后必须跑一次。
// 也用于"清理 node_modules 后恢复运行依赖"（见 capabilities 方法23）：
// 删除 node_modules 后重跑本脚本即可恢复 @deepseek-ai / schemastery 链接。
// 用法: node scripts/junction.mjs
import { mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const links = [
  {
    name: '@deepseek-ai',
    target: 'D:\\Dsh\\profiles\\node_modules\\@deepseek-ai',
  },
  {
    name: 'schemastery',
    target: 'D:\\Dsh\\profiles\\web\\node_modules\\schemastery',
  },
]

mkdirSync(join(root, 'node_modules'), { recursive: true })

for (const link of links) {
  const path = join(root, 'node_modules', link.name)
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
  }
  try {
    symlinkSync(link.target, path, 'junction')
    console.log(`✅ junction: node_modules/${link.name} -> ${link.target}`)
  } catch (error) {
    console.error(`❌ junction failed for ${link.name}: ${error.message}`)
    process.exit(1)
  }
}
console.log('junction 重打完成')
