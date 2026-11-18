/**
 * 量手敲的空格（U+0020）有多宽：落在英文系统字体上、落在苹方上，字号 13–40px。
 * 方法：同一段「用 Claude」加空格和不加空格各排一次，宽度相减，除以字号。
 * 用法：node space-width.mjs；依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage()
await page.setContent('<html lang="zh-CN"><body></body></html>')
const rows = await page.evaluate(() => {
  const stacks = { '英文系统字体在前': '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif', '苹方在前': '"PingFang SC", sans-serif' }
  const out = []
  for (const [name, ff] of Object.entries(stacks)) {
    for (const fs of [13, 14, 15, 16, 17, 18, 20, 24, 32, 40]) {
      const w = (t) => { const s = document.createElement('span'); s.style.cssText = `font:${fs}px/1 ${ff};white-space:pre`; s.textContent = t; document.body.append(s); const v = s.getBoundingClientRect().width; s.remove(); return v }
      out.push({ stack: name, fs, em: +((w('用 Claude') - w('用Claude')) / fs).toFixed(3) })
    }
  }
  return out
})
console.log('字体栈\t字号\t空格宽（em）')
for (const r of rows) console.log(`${r.stack}\t${r.fs}\t${r.em}`)
await browser.close()
