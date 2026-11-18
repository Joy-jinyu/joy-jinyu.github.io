/**
 * 在几份页面上运行 style-snippet.js，把面板上的统计抄下来（浅色和深色各一次）。
 * 用法：node snippet-run.mjs <style-snippet.js> <html 文件…>；依赖 playwright-core 和本机 Chrome。
 */
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
const [snippet, ...files] = process.argv.slice(2)
const code = readFileSync(snippet, 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
for (const f of files) {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme })
    await page.goto('file://' + resolve(f))
    await page.waitForTimeout(300)
    await page.evaluate(code)
    const txt = await page.evaluate(() => {
      const r = document.getElementById('__style_audit__').shadowRoot
      const out = [r.querySelector('h3').textContent, r.querySelector('p').textContent, ...[...r.querySelectorAll('h4')].map((h) => h.textContent)]
      const flagged = [...r.querySelectorAll('tr')].filter((tr) => tr.textContent.includes('变量之外')).map((tr) => tr.querySelector('.m').textContent)
      return out.join('\n') + (flagged.length ? '\n  变量之外：' + flagged.join('  ') : '')
    })
    console.log(`=== ${basename(f)}（${scheme === 'dark' ? '深色' : '浅色'}）\n${txt}`)
    await page.close()
  }
}
await browser.close()
