/**
 * 用 axe-core 扫一份产出，浅色、深色各一遍。
 * 注意：axe 默认配置不跑 target-size（点击区域）规则；这里按 WCAG 标签指定规则集，target-size 会跟着 wcag22aa 一起跑。
 * 用法：node axe.mjs <html 文件>。依赖 playwright-core、axe-core@4.10.3 和本机 Chrome（CHROME_PATH 可覆盖）
 */
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const file = resolve(process.argv[2])
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })

for (const colorScheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, colorScheme })
  await page.goto('file://' + file)
  await page.addScriptTag({ content: axeSource })
  const r = await page.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
    const ids = (list) => list.map((v) => `${v.id}(${v.nodes.length})`)
    return { version: axe.version, violations: res.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), passes: ids(res.passes.filter((p) => /target|contrast/.test(p.id))) }
  })
  console.log(colorScheme.padEnd(6), `axe ${r.version}`, JSON.stringify(r.violations), 'passed:', r.passes.join(' '))
  await page.close()
}
await browser.close()
