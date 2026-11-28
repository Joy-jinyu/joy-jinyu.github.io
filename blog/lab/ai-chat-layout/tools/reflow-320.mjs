/**
 * 320 px 宽时有没有横向滚动（WCAG 1.4.10 的宽度）：页面和消息区各量一次 scrollWidth。
 * 用法：node reflow-320.mjs <html 文件>...，依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）
 */
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
console.log('browser', b.version())
for (const f of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true })
  await p.goto('file://' + resolve(f)); await p.waitForTimeout(300)
  const r = await p.evaluate(() => {
    const doc = document.documentElement
    const scrollers = [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight })
    const main = scrollers.sort((a, b) => b.clientHeight - a.clientHeight)[0]
    return { page: doc.scrollWidth - innerWidth, scroller: main ? main.scrollWidth - main.clientWidth : null }
  })
  console.log(f.split('/').pop(), `页面横向溢出 ${r.page}px，消息区横向溢出 ${r.scroller}px`)
  await p.close()
}
await b.close()
