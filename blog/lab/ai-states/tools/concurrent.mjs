/**
 * 并发场景：第 1 行的删除请求 2 秒后才回，删它（在途）时接着删第 2 行，再点上传，最后读列表里剩下的文件名。
 * 用法：node concurrent.mjs <放着 files1-3.html 的 http 地址，例如 http://localhost:4399/blog/lab/ai-states/>
 * 依赖 playwright-core 和本机 Chrome。
 */
import { chromium } from 'playwright-core'
const FILES = [
  { id: 1, name: '2026Q3 报告.pdf', size: '2.4 MB', updatedAt: '10月28日' },
  { id: 2, name: '团队周会纪要.docx', size: '86 KB', updatedAt: '10月27日' },
  { id: 3, name: '产品路线图.key', size: '18.2 MB', updatedAt: '10月25日' },
  { id: 4, name: '设计稿-v3.fig', size: '42.7 MB', updatedAt: '10月22日' },
]
const base = process.argv[2]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const i of [1, 2, 3]) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  await p.route(/files\.json/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(FILES) }))
  // 第 1 行删得慢（2 秒），其他行马上回
  await p.route(/api\/files\/\d+/, async (r) => { if (/files\/1$/.test(r.request().url())) await sleep(2000); r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }) })
  await p.route(/api\/upload/, async (r) => { await sleep(2000); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 99, name: '新上传的文件.pdf', size: '1.1 MB', updatedAt: '刚刚' }) }) })
  await p.goto(`${base}files${i}.html`)
  await sleep(800)
  const del = (n) => p.locator('button:visible', { hasText: '删除' }).nth(n)
  const confirm = () => p.locator('dialog[open] button, [role="dialog"] button, [role="alertdialog"] button').filter({ hasText: /^\s*删除\s*$/ }).last()
  await del(0).click(); await sleep(250); await confirm().click(); await sleep(200)
  let second = 'ok'
  try { await del(1).click({ timeout: 1500 }); await sleep(250); await confirm().click({ timeout: 1500 }) } catch (e) { second = 'blocked: ' + String(e).split('\n')[0].slice(0, 80) }
  await sleep(200)
  // 删除还在途时上传
  let up = 'ok'
  try { await p.locator('button:visible', { hasText: '上传' }).first().click({ timeout: 1500 }) } catch (e) { up = 'blocked: ' + String(e).split('\n')[0].slice(0, 80) }
  await sleep(3000)
  const names = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /\.(pdf|docx|key|fig)$/.test(e.textContent.trim())).map((e) => e.textContent.trim()))
  console.log(`files${i}: 第二个删除 ${second}；删除在途时上传 ${up}；最后列表 ${JSON.stringify([...new Set(names)])}`)
  await ctx.close()
}
await b.close()
