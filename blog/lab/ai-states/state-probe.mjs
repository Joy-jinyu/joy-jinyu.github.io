/**
 * 状态探针：拦截页面的接口请求，逐个造出加载慢、空、出错、断网、挂起、连点、删除失败等场景，
 * 记录每个场景下页面显示的文字、焦点落在哪、发出了几次请求，并截图。
 * 用法：node state-probe.mjs <页面 URL（http，不能是 file://）> <输出目录>
 * 手机视口 375 宽、2 倍像素、触屏，依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'

const [url, outDir] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const FILES = [
  { id: 1, name: '2026Q3 报告.pdf', size: '2.4 MB', updatedAt: '10月28日' },
  { id: 2, name: '团队周会纪要.docx', size: '86 KB', updatedAt: '10月27日' },
  { id: 3, name: '产品路线图.key', size: '18.2 MB', updatedAt: '10月25日' },
  { id: 4, name: '设计稿-v3.fig', size: '42.7 MB', updatedAt: '10月22日' },
]
const NEW_FILE = { id: 99, name: '新上传的文件.pdf', size: '1.1 MB', updatedAt: '刚刚' }
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []

/** 开一个新页面；list / del / up 决定三个接口怎么回 */
async function open({ list = 'ok', del = 'ok', up = 'ok', listDelay = 0, delDelay = 0, upDelay = 0, watch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  // 记录加载提示（aria-busy 或骨架屏）从出现到消失的时间；要在页面脚本之前装上
  if (watch) await page.addInitScript(() => {
    window.__seen = []
    const t0 = performance.now()
    const tick = () => { const n = document.querySelectorAll('[aria-busy="true"],[class*="skel"]:not([hidden])').length; window.__seen.push([Math.round(performance.now() - t0), n]) }
    new MutationObserver(tick).observe(document, { subtree: true, childList: true, attributes: true })
  })
  const counts = { list: 0, del: 0, up: 0 }
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const reply = async (route, kind, delay, body) => {
    if (delay) await sleep(delay)
    if (kind === 'hang') return // 永不回应
    if (kind === 'abort') return route.abort('internetdisconnected')
    if (kind === '500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' })
    if (kind === '403') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"forbidden"}' })
    if (kind === 'bad') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":null}' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  }
  await page.route(/\/api\/files\.json/, (r) => { counts.list++; return reply(r, list, listDelay, list === 'empty' ? [] : FILES) })
  await page.route(/\/api\/files\/\d+/, (r) => { counts.del++; return reply(r, del, delDelay, { ok: true }) })
  await page.route(/\/api\/upload/, (r) => { counts.up++; return reply(r, up, upDelay, NEW_FILE) })
  return { ctx, page, counts, errors }
}

/** 页面上看得见的文字（去掉列表行之外的重复空白），加上焦点元素 */
const snap = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const text = document.body.innerText.replace(/\n{2,}/g, '\n').trim().slice(0, 1500)
  const a = document.activeElement
  const focus = a && a !== document.body ? `${a.tagName.toLowerCase()}「${(a.getAttribute('aria-label') || a.textContent || a.getAttribute('placeholder') || '').trim().slice(0, 20)}」` : 'body'
  const busy = [...document.querySelectorAll('[aria-busy="true"]')].length
  const live = [...document.querySelectorAll('[aria-live],[role="status"],[role="alert"]')].map((e) => `${e.getAttribute('role') || 'live'}:${e.textContent.trim().slice(0, 40)}`).filter((s) => !s.endsWith(':'))
  const skeleton = [...document.querySelectorAll('[class*="skel"],[class*="Skel"],[class*="placeholder"],[class*="shimmer"]')].filter(vis).length
  const rows = [...document.querySelectorAll('li, [role="listitem"], .file, .file-row, .row')].filter(vis).filter((e) => /\.(pdf|docx|key|fig)/.test(e.textContent)).length
  const dialog = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')].filter(vis).map((d) => d.textContent.trim().replace(/\s+/g, ' ').slice(0, 60))
  return { text, focus, busy, live, skeleton, rows, dialog }
})

const findDelete = (page, n = 1) => page.locator('button:visible', { hasText: '删除' }).nth(n)
const confirmBtn = (page) => page.locator('dialog[open] button, [role="dialog"] button, [role="alertdialog"] button').filter({ hasText: /^\s*删除\s*$/ }).last()
const uploadBtn = (page) => page.locator('button:visible', { hasText: '上传' }).first()

async function scenario(name, opts, fn) {
  const s = await open(opts)
  const rec = { name }
  try {
    await s.page.goto(url, { waitUntil: 'commit' })
    await fn(s, rec)
  } catch (e) {
    rec.fail = String(e).slice(0, 200)
  }
  rec.counts = s.counts
  rec.errors = s.errors
  await s.page.screenshot({ path: `${outDir}/${name}.png` }).catch(() => {})
  results.push(rec)
  await s.ctx.close()
}

await scenario('load-slow', { listDelay: 3000 }, async ({ page }, rec) => { await sleep(400); rec.at400ms = await snap(page) })
await scenario('load-fast-flash', { listDelay: 60, watch: true }, async ({ page }, rec) => {
  await sleep(1500)
  rec.after = await snap(page)
  // 加载提示出现过几毫秒：第一次看到 aria-busy / 骨架到最后一次看到它
  const seen = await page.evaluate(() => window.__seen ?? [])
  const on = seen.filter(([, n]) => n > 0).map(([t]) => t)
  rec.loadingVisibleMs = on.length ? on.at(-1) - on[0] : 0
})
await scenario('empty', { list: 'empty' }, async ({ page }, rec) => { await sleep(800); rec.snap = await snap(page) })
await scenario('error-500', { list: '500' }, async ({ page }, rec) => { await sleep(800); rec.snap = await snap(page) })
await scenario('error-403', { list: '403' }, async ({ page }, rec) => { await sleep(800); rec.snap = await snap(page) })
await scenario('error-network', { list: 'abort' }, async ({ page }, rec) => { await sleep(800); rec.snap = await snap(page) })
await scenario('error-badshape', { list: 'bad' }, async ({ page }, rec) => { await sleep(800); rec.snap = await snap(page) })
await scenario('hang-20s', { list: 'hang' }, async ({ page }, rec) => { await sleep(3000); rec.at3s = await snap(page); await sleep(17000); rec.at20s = await snap(page) })
await scenario('search-none', {}, async ({ page }, rec) => {
  await sleep(800)
  await page.locator('input:visible').first().fill('zzzz')
  await sleep(300)
  rec.snap = await snap(page)
})
await scenario('delete-ok', {}, async ({ page }, rec) => {
  await sleep(800)
  await findDelete(page).click()
  await sleep(300)
  rec.dialog = await snap(page)
  await confirmBtn(page).click()
  await sleep(800)
  rec.after = await snap(page)
})
await scenario('delete-slow', { delDelay: 3000 }, async ({ page }, rec) => {
  await sleep(800)
  await findDelete(page).click()
  await sleep(300)
  await confirmBtn(page).click()
  await sleep(400)
  rec.inflight = await snap(page)
  // 删除还没回来时，再点同一行的删除
  await findDelete(page).click({ timeout: 1000 }).catch((e) => { rec.secondClick = 'blocked: ' + String(e).slice(0, 60) })
  await sleep(300)
  rec.afterSecond = await snap(page)
  await sleep(3500)
  rec.done = await snap(page)
})
await scenario('delete-500', { del: '500' }, async ({ page }, rec) => {
  await sleep(800)
  await findDelete(page).click()
  await sleep(300)
  await confirmBtn(page).click()
  await sleep(800)
  rec.after = await snap(page)
})
await scenario('upload-double', { upDelay: 1500 }, async ({ page }, rec) => {
  await sleep(800)
  const b = uploadBtn(page)
  await b.click()
  await b.click({ timeout: 800, force: true }).catch(() => {})
  await b.click({ timeout: 800, force: true }).catch(() => {})
  await sleep(200)
  rec.inflight = await snap(page)
  await sleep(2000)
  rec.done = await snap(page)
})
await scenario('upload-500', { up: '500' }, async ({ page }, rec) => {
  await sleep(800)
  await uploadBtn(page).click()
  await sleep(800)
  rec.after = await snap(page)
})
await scenario('offline', {}, async ({ page, ctx }, rec) => {
  await sleep(800)
  await ctx.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await sleep(500)
  rec.offline = await snap(page)
  await page.screenshot({ path: `${outDir}/offline-during.png` })
  // 断网时点上传：有没有提前拦住
  await uploadBtn(page).click({ timeout: 1000 }).catch((e) => { rec.uploadWhileOffline = 'blocked: ' + String(e).slice(0, 60) })
  await sleep(600)
  rec.afterUploadOffline = await snap(page)
  await ctx.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await sleep(1000)
  rec.online = await snap(page)
})

await scenario('delete-hang', { del: 'hang' }, async ({ page }, rec) => {
  await sleep(800)
  await findDelete(page).click()
  await sleep(300)
  await confirmBtn(page).click()
  await sleep(3000)
  rec.at3s = await snap(page)
  await sleep(27000)
  rec.at30s = await snap(page)
})
await scenario('upload-hang', { up: 'hang' }, async ({ page }, rec) => {
  await sleep(800)
  await uploadBtn(page).click()
  await sleep(3000)
  rec.at3s = await snap(page)
  await sleep(27000)
  rec.at30s = await snap(page)
})
await scenario('delete-last', {}, async ({ page }, rec) => {
  await sleep(800)
  await findDelete(page, 3).click()
  await sleep(300)
  await confirmBtn(page).click()
  await sleep(800)
  rec.after = await snap(page)
})
await scenario('delete-all', {}, async ({ page }, rec) => {
  await sleep(800)
  for (let i = 0; i < 4; i++) {
    await findDelete(page, 0).click()
    await sleep(300)
    await confirmBtn(page).click()
    await sleep(600)
  }
  rec.after = await snap(page)
})
await scenario('dialog-cancel', {}, async ({ page }, rec) => {
  await sleep(800)
  await findDelete(page).click()
  await sleep(300)
  await page.keyboard.press('Escape')
  await sleep(300)
  rec.after = await snap(page)
})
await scenario('retry', { list: '500' }, async ({ page }, rec) => {
  await sleep(800)
  await page.unroute(/\/api\/files\.json/)
  await page.route(/\/api\/files\.json/, async (r) => { await sleep(1500); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FILES) }) })
  await page.locator('button:visible', { hasText: '重试' }).first().click()
  await sleep(300)
  rec.retrying = await snap(page)
  await sleep(2000)
  rec.after = await snap(page)
})
await scenario('upload-while-search', {}, async ({ page }, rec) => {
  await sleep(800)
  await page.locator('input:visible').first().fill('报告')
  await sleep(300)
  await uploadBtn(page).click()
  await sleep(800)
  rec.after = await snap(page)
})

// 交互状态：用 CDP 强制伪类，读按钮在各状态下的背景、文字色、轮廓
{
  const s = await open()
  await s.page.goto(url, { waitUntil: 'load' })
  await sleep(800)
  const cdp = await s.ctx.newCDPSession(s.page)
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
  const pick = async (handle) => {
    const { node } = await cdp.send('DOM.describeNode', { objectId: (await cdp.send('Runtime.evaluate', { expression: handle })).result.objectId })
    const { nodeIds } = await cdp.send('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [node.backendNodeId] })
    return nodeIds[0]
  }
  const targets = {
    upload: `[...document.querySelectorAll('button')].find(b => /上传/.test(b.textContent))`,
    delete: `[...document.querySelectorAll('button')].filter(b => /删除/.test(b.textContent))[0]`,
    search: `document.querySelector('input')`,
  }
  const states = {}
  for (const [k, expr] of Object.entries(targets)) {
    const id = await pick(expr)
    states[k] = {}
    for (const st of [[], ['hover'], ['active'], ['focus', 'focus-visible']]) {
      await cdp.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: st })
      states[k][st[0] ?? 'normal'] = await s.page.evaluate((e) => { const el = eval(e); const cs = getComputedStyle(el); return `${cs.backgroundColor} | ${cs.color} | outline ${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} | shadow ${cs.boxShadow.slice(0, 40)} | ${cs.transform}` }, expr)
    }
    await cdp.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: [] })
  }
  void root
  const css = await s.page.evaluate(() => [...document.querySelectorAll('style')].map((x) => x.textContent).join('\n'))
  results.push({
    name: 'pseudo-states',
    states,
    css: {
      hoverRules: (css.match(/:hover/g) ?? []).length,
      hoverInMedia: /@media[^{]*hover\s*:\s*hover/.test(css),
      active: (css.match(/:active/g) ?? []).length,
      focusVisible: (css.match(/:focus-visible/g) ?? []).length,
      disabled: (css.match(/:disabled|\[disabled\]|aria-disabled/g) ?? []).length,
      tapHighlight: (css.match(/-webkit-tap-highlight-color\s*:\s*([^;]+)/) ?? [])[1] ?? null,
      reducedMotion: /prefers-reduced-motion/.test(css),
    },
  })
  await s.ctx.close()
}

writeFileSync(`${outDir}/states.json`, JSON.stringify(results, null, 1))
await browser.close()
