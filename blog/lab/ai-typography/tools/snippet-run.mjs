// 在指定页面上跑 type-snippet.js，把面板里的文字读出来
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
const [snippet, ...files] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
for (const f of files) {
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(f.startsWith('http') ? f : 'file://' + resolve(f), { waitUntil: 'load' })
  await p.waitForTimeout(300)
  await p.addScriptTag({ content: readFileSync(snippet, 'utf8') })
  const txt = await p.evaluate(() => document.getElementById('__type_audit__')?.shadowRoot?.querySelector('.p')?.innerText ?? '[没有面板]')
  console.log(`=== ${f.split('/').pop()}${errs.length ? ' 报错:' + errs.join('|') : ''}\n${txt.split('\n全部样式')[0]}`)
  await p.close()
}
await b.close()
