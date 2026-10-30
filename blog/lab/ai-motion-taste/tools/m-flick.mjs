import { chromium } from 'playwright-core'
import fs from 'node:fs'
const DIR = process.argv[2]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const out = {}
out.browser = b.version()
for (const n of ['sheet1', 'sheet2']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const p = await ctx.newPage(); await p.goto(`file://${DIR}/${n}.html`)
  const cdp = await ctx.newCDPSession(p)
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
  const isOpen = () => p.evaluate(() => { const s = document.querySelector('[role=dialog]'); const r = s.getBoundingClientRect(); return r.top < innerHeight - 40 && !s.closest('[hidden]') && getComputedStyle(s).visibility !== 'hidden' })
  const open = async () => { if (!(await isOpen())) { await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '分享').click()); await p.waitForTimeout(700) } }
  const grab = async () => p.evaluate(() => { const r = document.querySelector('[role=dialog]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 12 } })
  const res = {}
  for (const [label, steps, dy, gap, holdMs] of [['甩 60px，约 50ms', 6, 10, 8, 0], ['甩 90px，约 50ms', 6, 15, 8, 0], ['快拉 90px 后停 300ms 再松', 6, 15, 8, 300], ['慢拉 45px（约 20%）', 9, 5, 30, 0]]) {
    await open(); const g = await grab(); const t0 = Date.now()
    await touch('touchStart', g.x, g.y); for (let i = 1; i <= steps; i++) { await touch('touchMove', g.x, g.y + i * dy); await p.waitForTimeout(gap) }
    const moveMs = Date.now() - t0; if (holdMs) await p.waitForTimeout(holdMs); await touch('touchEnd'); await p.waitForTimeout(700)
    res[label] = { closed: !(await isOpen()), moveMs }
  }
  out[n] = res; await ctx.close()
}
console.log(JSON.stringify(out, null, 1)); fs.writeFileSync('m-flick.json', JSON.stringify(out, null, 1)); await b.close()
