/** 浏览器版 X 光（xray-snippet.js，按字体度量推算墨迹）和像素法（xray.mjs）对比：每块文字往下「看到的」间距差多少。用法：node snippet-validate.mjs <ai-spacing 目录>；依赖 playwright-core 和本机 Chrome */
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const L = process.argv[2]
const snippet = readFileSync(`${L}/xray-snippet.js`, 'utf8')
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const overlap = (a, c) => Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) > 1
const all = []
for (const f of ['settings1', 'settings2', 'settings3', 'settings1-fixed']) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  await p.goto(`file://${L}/${f}.html`); await p.waitForTimeout(300)
  await p.addStyleTag({ content: '*{transition:none!important}' })
  await p.setViewportSize({ width: 375, height: 1000 })
  const res = await p.evaluate(snippet + ';window.__spacingXray')
  const px = JSON.parse(readFileSync(`${L}/data/${f}.json`, 'utf8')).atoms
  const pxText = px.filter((a) => a.kind === 'text')
  for (const t of pxText) {
    let best = null
    for (const a of px) {
      if (a === t) continue
      const q = a.kind === 'box' ? null : a.ink
      const cands = a.kind === 'box' ? [...((a.fill || a.sides.includes('top')) ? [a.rect.y] : []), ...((a.fill || a.sides.includes('bottom')) ? [a.rect.y + a.rect.h] : [])].map((y) => ({ y, x: a.rect.x, w: a.rect.w })) : [{ y: q.y, x: q.x, w: q.w }]
      for (const c of cands) { if (!overlap(c, t.ink)) continue; const d = c.y - (t.ink.y + t.ink.h); if (d >= -0.5 && (best == null || d < best)) best = d }
    }
    const s = res.find((r) => r.text === t.text.slice(0, 20))
    if (s && best != null && s.seen != null && best <= 48) all.push({ f, text: t.text.slice(0, 10), pixel: +best.toFixed(1), metric: s.seen, diff: +(s.seen - best).toFixed(1) })
  }
  await ctx.close()
}
console.table(all)
const d = all.map((x) => Math.abs(x.diff)).sort((a, c) => a - c)
console.log('n', d.length, 'median', d[Math.floor(d.length / 2)], 'p90', d[Math.floor(d.length * 0.9)], 'max', d.at(-1))
await b.close()
