/** 在文章页本身上跑浏览器版 X 光（xray-snippet.js），列出写的 14–16px 的间距（正文段落之间是 0.9em ≈ 15px）。用法：node article-xray.mjs <文章 URL>；1280×900 视口；依赖 playwright-core 和本机 Chrome */
import { chromium } from 'playwright-core'
const url = process.argv[2]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
await p.goto(url, { waitUntil: 'networkidle' })
const src = await (await fetch(new URL('../lab/ai-spacing/xray-snippet.js', url))).text()
const out = new Set()
for (const y of [1800, 4200, 6500]) {
  await p.evaluate((yy) => scrollTo(0, yy), y)
  await p.waitForTimeout(200)
  const r = await p.evaluate(src + ';window.__spacingXray')
  for (const x of r.filter((x) => x.written >= 14 && x.written <= 16)) out.add(`写 ${x.written} → 看 ${x.seen}  ${x.text}`)
  await p.evaluate(src)
}
console.log(`${b.version()} ${url}\n${[...out].join('\n')}`)
await b.close()
