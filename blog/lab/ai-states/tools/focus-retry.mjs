/**
 * 重试后焦点去了哪：列表接口第一次回 500，聚焦「重试」按回车，第二次 800ms 后成功；读 activeElement，再按一次 Tab 再读。
 * 用法：node focus-retry.mjs <放着 files1-3.html 的 http 地址，例如 http://localhost:4399/blog/lab/ai-states/>
 * 依赖 playwright-core 和本机 Chrome。
 */
import { chromium } from 'playwright-core'
const FILES = [{ id: 1, name: '2026Q3 报告.pdf', size: '2.4 MB', updatedAt: '10月28日' }, { id: 2, name: '团队周会纪要.docx', size: '86 KB', updatedAt: '10月27日' }]
const base = process.argv[2]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const out = []
for (const i of [1, 2, 3]) {
  const p = await b.newPage({ viewport: { width: 375, height: 812 } })
  let fail = true
  await p.route(/files\.json/, async (r) => { if (fail) { fail = false; return r.fulfill({ status: 500, body: '{}' }) } await new Promise((x) => setTimeout(x, 800)); r.fulfill({ contentType: 'application/json', body: JSON.stringify(FILES) }) })
  await p.goto(`${base}files${i}.html`); await p.waitForTimeout(600)
  const retry = p.locator('button:visible', { hasText: '重试' }).first()
  await retry.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1500)
  const who = () => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : `${a.tagName.toLowerCase()}「${(a.getAttribute('aria-label') || a.textContent || a.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 16)}」` })
  const after = await who()
  await p.keyboard.press('Tab'); const tab1 = await who()
  out.push(`files${i}: 重试并加载完成后 activeElement=${after}；再按一次 Tab → ${tab1}`)
  await p.close()
}
console.log(out.join('\n'))
await b.close()
