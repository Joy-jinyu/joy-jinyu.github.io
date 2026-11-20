import { chromium } from 'playwright-core'
import fs from 'node:fs'
const DIR = process.argv[2], OUT = process.argv[3]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const rec = fs.readFileSync('rec.js', 'utf8')
const helpers = `
window.__sheet = () => document.querySelector('[role=dialog]')
window.__open = () => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '分享')
window.__ty = () => { const m = new DOMMatrix(getComputedStyle(__sheet()).transform); return Math.round(m.m42 * 10) / 10 }
window.__isOpen = () => { const s = __sheet(); const r = s.getBoundingClientRect(); return r.top < innerHeight - 40 && getComputedStyle(s).visibility !== 'hidden' && !s.closest('[hidden]') }
`
const result = {}
result.browser = b.version()
for (const n of ['sheet1','sheet2']) {
  const r = (result[n] = {})
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage(); await p.addInitScript(rec); await p.addInitScript(helpers)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(`file://${DIR}/${n}.html`); await p.waitForTimeout(300)
  const cdp = await ctx.newCDPSession(p)
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
  const openSheet = async () => { await p.evaluate(() => __open().click()); await p.waitForTimeout(700) }
  const closeIfOpen = async () => { if (await p.evaluate(() => __isOpen())) { await p.keyboard.press('Escape'); await p.waitForTimeout(600); if (await p.evaluate(() => __isOpen())) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '取消').click()); await p.waitForTimeout(600) } } }
  // 打开过程
  r.openTrace = await p.evaluate(async () => { const pr = __rec(() => ({ ty: __ty() }), 600); __open().click(); return pr })
  await p.waitForTimeout(200)
  r.sheetH = await p.evaluate(() => __sheet().getBoundingClientRect().height)
  // 从把手往下拖：每 16ms 移 8px，共 15 步（120px），记录每一步面板位移和手指位移
  const grab = await p.evaluate(() => { const r = __sheet().getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 12 } })
  const drag = async (start, steps, dy, gap) => {
    const log = []
    await touch('touchStart', start.x, start.y)
    for (let i = 1; i <= steps; i++) { await touch('touchMove', start.x, start.y + i * dy); await p.waitForTimeout(gap); log.push({ finger: i * dy, ty: await p.evaluate(() => __ty()) }) }
    return log
  }
  r.follow = await drag(grab, 15, 8, 16)
  // 停住 200ms 再松手（速度≈0），看它按距离决定
  await p.waitForTimeout(200)
  const relTrace = p.evaluate(() => __rec(() => ({ ty: __ty() }), 600))
  await touch('touchEnd'); r.releaseAfter120 = await relTrace; await p.waitForTimeout(300)
  r.closedAfter120Slow = !(await p.evaluate(() => __isOpen()))
  await closeIfOpen(); await openSheet()
  // 拖 25% 的高度慢慢松手：应该弹回
  const quarter = Math.round(r.sheetH * 0.22 / 8)
  await drag(grab, quarter, 8, 16); await p.waitForTimeout(200)
  const back = p.evaluate(() => __rec(() => ({ ty: __ty() }), 600)); await touch('touchEnd'); r.springBack = await back
  r.closedAfter22pct = !(await p.evaluate(() => __isOpen()))
  await closeIfOpen(); await openSheet()
  // 快速一甩：40px，3 步，每步 10ms，立即松手
  await drag(grab, 4, 10, 8); await touch('touchEnd'); await p.waitForTimeout(700)
  r.closedAfterFlick40 = !(await p.evaluate(() => __isOpen()))
  await closeIfOpen(); await openSheet()
  // 从内容区（第一个渠道按钮）开始拖
  const chan = await p.evaluate(() => { const r = document.querySelector('[role=dialog] .channel, [role=dialog] li button').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  const fromContent = await drag(chan, 10, 8, 16)
  r.dragFromContent = fromContent.at(-1)
  await touch('touchEnd'); await p.waitForTimeout(700)
  r.toastAfterContentDrag = await p.evaluate(() => [...document.querySelectorAll('[role=status]')].map((t) => t.textContent.trim()).join('|'))
  await closeIfOpen(); await p.waitForTimeout(300)
  // 打开动画进行到一半时按住
  r.grabMidOpen = await p.evaluate(async () => { __open().click(); await __sleep(90); return __ty() })
  const g2 = await p.evaluate(() => { const r = __sheet().getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 12 } })
  await touch('touchStart', g2.x, g2.y); await p.waitForTimeout(30); r.afterGrab = await p.evaluate(() => __ty())
  await touch('touchMove', g2.x, g2.y + 10); await p.waitForTimeout(30); r.afterGrabMove = await p.evaluate(() => __ty())
  await touch('touchEnd'); await p.waitForTimeout(700)
  await closeIfOpen()
  // 往上拖：有阻尼吗
  await openSheet()
  const up = await drag(grab, 6, -10, 16); r.dragUp = up.at(-1); await touch('touchEnd'); await p.waitForTimeout(600)
  await closeIfOpen()
  // 关闭过程
  await openSheet(); r.closeTrace = await p.evaluate(async () => { const pr = __rec(() => ({ ty: __ty() }), 600); [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '取消').click(); return pr })
  await p.waitForTimeout(300)
  await p.emulateMedia({ reducedMotion: 'reduce' })
  r.reducedOpen = await p.evaluate(async () => { const pr = __rec(() => ({ ty: __ty() }), 300); __open().click(); return pr })
  r.errors = errs
  await ctx.close()
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 1))
for (const [k, r] of Object.entries(result)) {
  if (k === 'browser') { console.log('browser', r); continue }
  const ot = r.openTrace; const start = ot[0].ty; const t95 = ot.find((x) => Math.abs(x.ty) <= Math.abs(start) * 0.05)?.t
  const ct = r.closeTrace; const end = Math.max(...ct.map((x) => x.ty)); const c95 = ct.find((x) => x.ty >= end * 0.95)?.t
  const lag = r.follow.map((x) => Math.round(x.finger - x.ty))
  let maxD = 0; for (let i = 1; i < r.springBack.length; i++) maxD = Math.max(maxD, Math.abs(r.springBack[i].ty - r.springBack[i - 1].ty))
  console.log(k, 'H', r.sheetH, 'open t95', t95, 'close t95', c95, 'from', start)
  console.log('  follow lag (finger-ty) per step', lag.join(','))
  console.log('  120px slow release closed?', r.closedAfter120Slow, '| 22% slow closed?', r.closedAfter22pct, 'springBack first', r.springBack[0]?.ty, 'maxFrame', Math.round(maxD), '| flick 40px closed?', r.closedAfterFlick40)
  console.log('  drag from content', JSON.stringify(r.dragFromContent), 'toast', JSON.stringify(r.toastAfterContentDrag))
  console.log('  grab mid-open: before', r.grabMidOpen, 'after grab', r.afterGrab, 'after +10', r.afterGrabMove, '| drag up 60 ->', JSON.stringify(r.dragUp))
  console.log('  reduced first', JSON.stringify(r.reducedOpen.slice(0, 3)), 'errors', r.errors.length)
}
await b.close()
