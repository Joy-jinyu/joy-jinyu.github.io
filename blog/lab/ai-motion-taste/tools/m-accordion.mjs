import { chromium } from 'playwright-core'
import fs from 'node:fs'
const DIR = process.argv[2], OUT = process.argv[3]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const rec = fs.readFileSync('rec.js', 'utf8')
const result = {}
result.browser = b.version()
for (const n of ['accordion1','accordion2','accordion1-fixed','accordion1-fixed-v1']) {
  const r = (result[n] = {})
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage(); await p.addInitScript(rec)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(`file://${DIR}/${n}.html`); await p.waitForTimeout(300)
  // 找出最长和最短的答案
  const info = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button[aria-expanded]')]
    const regs = btns.map((bt) => document.getElementById(bt.getAttribute('aria-controls')))
    const full = regs.map((rg) => rg.scrollHeight || rg.firstElementChild?.scrollHeight)
    return { count: btns.length, full }
  })
  r.info = info
  const cs = await p.evaluate(() => { const bt = document.querySelector('button[aria-expanded]'); const rg = document.getElementById(bt.getAttribute('aria-controls')); const c = getComputedStyle(rg); return { prop: c.transitionProperty, dur: c.transitionDuration, ease: c.transitionTimingFunction } })
  r.css = cs
  // 打开一次、量完整高度；每个答案打开后的最终高度
  const heights = []
  for (let i = 0; i < info.count; i++) {
    heights.push(await p.evaluate(async (i) => {
      const bt = document.querySelectorAll('button[aria-expanded]')[i]; const rg = document.getElementById(bt.getAttribute('aria-controls'))
      bt.click(); await __sleep(700); const h = rg.getBoundingClientRect().height; bt.click(); await __sleep(700); return h
    }, i))
  }
  r.finalHeights = heights
  const longI = heights.indexOf(Math.max(...heights)), shortI = heights.indexOf(Math.min(...heights))
  const trace = async (i, script) => p.evaluate(async ({ i, script }) => {
    const bt = document.querySelectorAll('button[aria-expanded]')[i]; const rg = document.getElementById(bt.getAttribute('aria-controls'))
    const pr = __rec(() => ({ h: Math.round(rg.getBoundingClientRect().height * 10) / 10, op: +getComputedStyle(rg.firstElementChild || rg).opacity }), script.total)
    for (const [at] of script.clicks.map((x) => [x])) { await __sleep(at - (window.__lastAt || 0)); window.__lastAt = at; bt.click() }
    window.__lastAt = 0
    return pr
  }, { i, script })
  r.openLong = await trace(longI, { total: 600, clicks: [0] }); await p.waitForTimeout(400)
  r.closeLong = await trace(longI, { total: 600, clicks: [0] }); await p.waitForTimeout(400)
  r.openShort = await trace(shortI, { total: 600, clicks: [0] }); await p.waitForTimeout(400)
  await trace(shortI, { total: 500, clicks: [0] }); await p.waitForTimeout(300)
  r.interruptLong = await trace(longI, { total: 900, clicks: [0, 120] }); await p.waitForTimeout(400)
  r.rapidLong = await trace(longI, { total: 1200, clicks: [0, 60, 120, 180, 240] }); await p.waitForTimeout(600)
  r.rapidFinal = await p.evaluate((i) => { const bt = document.querySelectorAll('button[aria-expanded]')[i]; const rg = document.getElementById(bt.getAttribute('aria-controls')); return { expanded: bt.getAttribute('aria-expanded'), h: rg.getBoundingClientRect().height } }, longI)
  // 布局次数：动画期间每帧都重排吗
  const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable')
  const lc = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'LayoutCount').value
  await p.evaluate((i) => { const bt = document.querySelectorAll('button[aria-expanded]')[i]; if (bt.getAttribute('aria-expanded') === 'true') bt.click() }, longI); await p.waitForTimeout(600)
  const l0 = await lc(); await p.evaluate((i) => document.querySelectorAll('button[aria-expanded]')[i].click(), longI); await p.waitForTimeout(600); const l1 = await lc()
  r.layoutsDuringOpen = l1 - l0
  // 减少动态效果
  await p.evaluate((i) => document.querySelectorAll('button[aria-expanded]')[i].click(), longI); await p.waitForTimeout(600)
  await p.emulateMedia({ reducedMotion: 'reduce' })
  r.reducedOpen = await trace(longI, { total: 300, clicks: [0] })
  r.errors = errs
  await ctx.close()
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 1))
const s = (tr) => { const hs = tr.map((x) => x.h); const max = Math.max(...hs); const t95 = tr.find((x) => x.h >= max * 0.95)?.t; let maxD = 0; for (let i = 1; i < tr.length; i++) maxD = Math.max(maxD, Math.abs(tr[i].h - tr[i - 1].h)); return { max, t95, maxFrameDelta: Math.round(maxD) } }
for (const [k, r] of Object.entries(result)) {
  if (k === 'browser') { console.log('browser', r); continue }
  console.log(k, JSON.stringify(r.css), 'heights', r.finalHeights.map(Math.round).join(','))
  console.log('  openLong', JSON.stringify(s(r.openLong)), 'openShort', JSON.stringify(s(r.openShort)))
  const cl = r.closeLong; const tz = cl.find((x) => x.h <= 1)?.t; console.log('  closeLong to0 at', tz)
  const it = r.interruptLong; let maxD = 0; for (let i = 1; i < it.length; i++) maxD = Math.max(maxD, Math.abs(it[i].h - it[i - 1].h)); const peak = Math.max(...it.map((x) => x.h)); console.log('  interrupt peak', peak, 'maxFrameDelta', Math.round(maxD), 'zero at', it.find((x, i) => i > 3 && x.h <= 1)?.t)
  console.log('  rapid final', JSON.stringify(r.rapidFinal), 'layouts during open', r.layoutsDuringOpen)
  console.log('  reduced first frames', JSON.stringify(r.reducedOpen.slice(0, 3)), 'errors', r.errors.length)
}
await b.close()
