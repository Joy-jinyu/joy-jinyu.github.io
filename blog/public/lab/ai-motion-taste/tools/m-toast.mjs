import { chromium } from 'playwright-core'
import fs from 'node:fs'
const DIR = process.argv[2], OUT = process.argv[3]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const rec = fs.readFileSync('rec.js', 'utf8')
const helpers = `
window.__closes = () => [...document.querySelectorAll('button')].filter(b => /关闭|×|✕/.test((b.getAttribute('aria-label')||'') + b.textContent) && b.offsetParent)
window.__cards = () => __closes().map(c => c.closest('[role=status],[role=alert],li,.toast') || c.parentElement)
window.__trig = (i) => [...document.querySelectorAll('button')].filter(b => /保存成功|上传失败|新消息/.test(b.textContent))[i]
`
const result = {}
result.browser = b.version()
for (const n of [1, 2]) for (const [vw, vh] of [[1280, 800], [390, 844]]) {
  const key = `toast${n}@${vw}`; const r = (result[key] = {})
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, hasTouch: vw < 500 })
  const p = await ctx.newPage(); await p.addInitScript(rec); await p.addInitScript(helpers)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(`file://${DIR}/toast${n}.html`); await p.waitForTimeout(300)
  // 进场：点一下，逐帧记录新卡片的透明度和位置
  r.enter = await p.evaluate(async () => {
    const pr = __rec(() => { const c = __cards()[0]; if (!c) return { op: null }; const cs = getComputedStyle(c); const rc = c.getBoundingClientRect(); return { op: +cs.opacity, y: Math.round(rc.y), x: Math.round(rc.x) } }, 700)
    __trig(0).click(); return pr
  })
  await p.waitForTimeout(200)
  await p.evaluate(async () => { __trig(1).click(); await __sleep(80); __trig(2).click() }); await p.waitForTimeout(700)
  r.countAfter3 = await p.evaluate(() => __cards().length)
  // 关掉中间那条，记录另外两条每帧的位置
  r.dismissMiddle = await p.evaluate(async () => {
    const cards = __cards(); const sorted = [...cards].sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y)
    const mid = sorted[1]; const others = [sorted[0], sorted[2]]
    const pr = __rec(() => ({ ys: others.map((c) => Math.round(c.getBoundingClientRect().y * 10) / 10) }), 800)
    const btn = __closes().find((c) => mid.contains(c)); btn.click(); return pr
  })
  // 悬停暂停：悬停 5.5 秒还在不在
  await p.evaluate(() => __closes().forEach((c) => c.click())); await p.waitForTimeout(900)
  await p.evaluate(() => __trig(0).click()); await p.waitForTimeout(500)
  const box = await p.evaluate(() => { const r = __cards()[0].getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 } })
  if (vw > 500) { await p.mouse.move(box.x, box.y); await p.waitForTimeout(5500); r.hoverStill = await p.evaluate(() => __cards().length); await p.mouse.move(5, 5); await p.waitForTimeout(4600); r.afterLeave = await p.evaluate(() => __cards().length) }
  // 键盘焦点暂停
  await p.waitForTimeout(500); await p.evaluate(() => __trig(0).click()); await p.waitForTimeout(400)
  await p.evaluate(() => __closes()[0].focus()); await p.waitForTimeout(5000); r.focusStill = await p.evaluate(() => __cards().length)
  await p.evaluate(() => document.activeElement.blur()); await p.evaluate(() => __closes().forEach((c) => c.click())); await p.waitForTimeout(900)
  // 连点 8 次：几条，有没有重叠
  r.burst = await p.evaluate(async () => { for (let i = 0; i < 8; i++) { __trig(i % 3).click(); await __sleep(40) } await __sleep(900); const rs = __cards().map((c) => c.getBoundingClientRect()); let overlap = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap++ } const offscreen = rs.filter((r) => r.top < 0 || r.bottom > innerHeight).length; return { n: rs.length, overlap, offscreen } })
  await p.evaluate(() => __closes().forEach((c) => c.click())); await p.waitForTimeout(900)
  // 进场一半就关掉
  r.closeDuringEnter = await p.evaluate(async () => { __trig(0).click(); await __sleep(60); const c = __cards()[0]; const pr = __rec(() => ({ op: +getComputedStyle(c).opacity, conn: c.isConnected }), 700); __closes()[0].click(); return pr })
  // 减少动态效果下关掉中间那条
  await p.waitForTimeout(500); await p.emulateMedia({ reducedMotion: 'reduce' })
  await p.evaluate(async () => { __trig(0).click(); await __sleep(80); __trig(1).click(); await __sleep(80); __trig(2).click() }); await p.waitForTimeout(800)
  r.reducedDismiss = await p.evaluate(async () => { const cards = __cards(); const sorted = [...cards].sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y); const mid = sorted[1]; const others = [sorted[0], sorted[2]]; const pr = __rec(() => ({ ys: others.map((c) => Math.round(c.getBoundingClientRect().y)) }), 600); __closes().find((c) => mid.contains(c)).click(); return pr })
  r.live = await p.evaluate(() => [...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} role=${e.getAttribute('role')} live=${e.getAttribute('aria-live')} static=${!e.closest('[data-dyn]')}`))
  r.errors = errs
  await ctx.close()
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 1))
const jump = (tr, k) => { let m = 0; for (let i = 1; i < tr.length; i++) for (let j = 0; j < tr[i].ys.length; j++) m = Math.max(m, Math.abs(tr[i].ys[j] - tr[i - 1].ys[j])); const total = tr[0].ys.map((y, j) => Math.round(Math.abs(tr.at(-1).ys[j] - y))); return { maxFrame: Math.round(m), total } }
for (const [k, r] of Object.entries(result)) {
  if (k === 'browser') { console.log('browser', r); continue }
  const e = r.enter.filter((x) => x.op != null); const t95 = e.find((x) => x.op >= 0.95)?.t
  console.log(k, 'enter op>=.95 at', t95, 'count3', r.countAfter3, 'dismissMiddle', JSON.stringify(jump(r.dismissMiddle)), 'reducedDismiss', JSON.stringify(jump(r.reducedDismiss)))
  console.log('  hoverStill', r.hoverStill, 'afterLeave', r.afterLeave, 'focusStill', r.focusStill, 'burst', JSON.stringify(r.burst), 'closeDuringEnter gone at', r.closeDuringEnter.find((x) => !x.conn)?.t, 'errors', r.errors.length)
  console.log('  live', r.live.join(' | '))
}
await b.close()
