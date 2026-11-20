/**
 * 引号和破折号三种画法：系统英文字体（不做处理）、苹方的默认字形（release1/2 的做法）、苹方打开 fwid 取全角（release3 的做法），
 * 再各看 text-spacing-trim 默认值（normal）和关掉（space-all）时，相邻的”“占多宽。
 * 用法：node quotes.mjs <输出 txt> [截图目录]。依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const [out, shotDir] = process.argv.slice(2)
const FS = 40
const BASE = '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
const FACES = {
  系统英文字体: '',
  苹方默认字形: `@font-face{font-family:"Q";src:local("PingFangSC-Regular"),local("PingFang SC Regular");unicode-range:U+2014,U+2018-2019,U+201C-201D}`,
  苹方全角字形: `@font-face{font-family:"Q";src:local("PingFangSC-Regular"),local("PingFang SC Regular");unicode-range:U+2014,U+2018-2019,U+201C-201D;font-feature-settings:"fwid"}`,
}
const TEXT = '可以选“1 天”“7 天”或“永久”——过期后失效。'

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport: { width: 1200, height: 200 }, deviceScaleFactor: 2 })
const lines = [`Chrome ${browser.version()}，${FS}px；宽度是字符盒子的宽（advance），单位 em`]
for (const [name, face] of Object.entries(FACES)) {
  for (const trim of ['normal', 'space-all']) {
    await page.setContent(`<html lang="zh-CN"><head><style>${face}</style></head><body style="margin:0;background:#fff"><p id="t" style='display:inline-block;margin:20px 30px;font-size:${FS}px;line-height:1.6;color:#111;white-space:nowrap;font-family:${face ? '"Q",' : ''}${BASE};text-spacing-trim:${trim}'>${TEXT}</p></body></html>`)
    await page.evaluate(() => document.fonts.ready)
    const ws = await page.evaluate(() => {
      const n = document.getElementById('t').firstChild
      const rg = document.createRange()
      return [...n.data].map((ch, i) => { rg.setStart(n, i); rg.setEnd(n, i + 1); return { ch, w: rg.getBoundingClientRect().width } })
    })
    const em = (c) => (c.w / FS).toFixed(2)
    const q = ws.filter((c) => '“”—'.includes(c.ch)).map((c) => c.ch + em(c)).join(' ')
    lines.push(`${name}，text-spacing-trim: ${trim}：${q}`)
    if (shotDir && trim === 'normal') await page.locator('#t').screenshot({ path: `${shotDir}/quotes-${Object.keys(FACES).indexOf(name) + 1}.png` })
  }
}
writeFileSync(out, lines.join('\n') + '\n')
await browser.close()
console.log(lines.join('\n'))
