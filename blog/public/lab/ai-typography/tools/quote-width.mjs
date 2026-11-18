/**
 * 引号宽度随字号变：在 13、15、17、40px 下量左双引号 U+201C 的宽度（advance ÷ 字号），英文系统字体栈和苹方各一遍。
 * 用法：node quote-width.mjs；依赖 playwright-core 和本机 Chrome（macOS）。
 */
import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const p = await b.newPage()
await p.setContent('<body></body>')
const r = await p.evaluate(() => [13, 15, 17, 40].map((px) => {
  const m = (ff) => { const s = document.createElement('span'); s.style.cssText = `font-size: ${px}px; font-family: ${ff}; white-space: pre`; s.textContent = '“'; document.body.append(s); const w = s.getBoundingClientRect().width / px; s.remove(); return w.toFixed(3) }
  return `${px}px：英文系统字体 ${m("-apple-system, BlinkMacSystemFont")}em，苹方 ${m('"PingFang SC"')}em`
}))
console.log(`Chrome ${b.version()}`); console.log(r.join('\n')); await b.close()
