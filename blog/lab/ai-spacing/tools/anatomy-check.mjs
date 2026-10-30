/** 实时解剖演示（TextAnatomy.astro）按字体度量画的墨迹框，和逐像素扫描差多少，换算成 16px 字号。用法：node anatomy-check.mjs（需要先起本地预览，地址写在下面）；依赖 playwright-core 和本机 Chrome */
import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' })
await ctx.addInitScript(() => localStorage.setItem('starlight-theme', 'light'))
const p = await ctx.newPage()
await p.goto('http://127.0.0.1:4437/blog/ai-spacing/', { waitUntil: 'networkidle' })
await p.locator('text-anatomy').scrollIntoViewIfNeeded()
for (const s of ['邮件摘要', '8812 3390']) for (const m of ['none', 'trim', 'pad']) {
  await p.click(`text-anatomy [data-sample="${s}"]`); await p.click(`text-anatomy [data-trim="${m}"]`); await p.waitForTimeout(400)
  const g = await p.evaluate(() => {
    const t = document.querySelector('text-anatomy .ta-text'), ink = document.querySelector('text-anatomy .ta-ink')
    const r = t.getBoundingClientRect(), k = ink.getBoundingClientRect()
    return { scale: parseFloat(t.style.fontSize) / 16, box: { t: r.top, b: r.bottom, l: r.left, w: r.width }, ink: { t: k.top + 1.5, b: k.bottom - 1.5 } }
  })
  await p.evaluate(() => (document.querySelector('text-anatomy .ta-ov').style.visibility = 'hidden'))
  const clip = { x: g.box.l, y: g.box.t - 40, width: g.box.w, height: g.box.b - g.box.t + 80 }
  const buf = await p.screenshot({ clip })
  const rows = await p.evaluate(async (b64) => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = new OffscreenCanvas(bmp.width, bmp.height); const x = c.getContext('2d'); x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, bmp.width, bmp.height).data; let t = -1, bt = -1; for (let y = 0; y < bmp.height; y++) for (let i = 0; i < bmp.width; i++) { const j = (y * bmp.width + i) * 4; if (Math.min(d[j], d[j + 1], d[j + 2]) < 200) { if (t < 0) t = y; bt = y; break } } return { t, bt } }, buf.toString('base64'))
  await p.evaluate(() => (document.querySelector('text-anatomy .ta-ov').style.visibility = ''))
  const pt = clip.y + rows.t / 2, pb = clip.y + (rows.bt + 1) / 2
  const f = (v) => (v / g.scale).toFixed(2)
  console.log(`${s}\t${m}\t上边差 ${f(g.ink.t - pt)} px\t下边差 ${f(g.ink.b - pb)} px（16px 字号下，正数=红框偏下）`)
}
await b.close()
