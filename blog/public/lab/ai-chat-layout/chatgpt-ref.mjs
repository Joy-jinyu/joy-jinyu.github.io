// 量 ChatGPT 未登录首页的输入框位置、字号和 viewport，并保存样式表：node chatgpt-ref.mjs <输出目录>
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const out = process.argv[2]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const MUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const res = {}
for (const [w, h, mobile] of [[1440, 900, false], [1024, 768, false], [768, 1024, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, userAgent: mobile ? MUA : UA, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  const p = await ctx.newPage()
  const css = []
  p.on('response', async r => { if (r.url().includes('.css')) { try { css.push(await r.text()) } catch {} } })
  await p.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 40000 }); await p.waitForTimeout(7000)
  res[w] = await p.evaluate(() => {
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } }
    const ta = document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]')
    let form = ta; for (let i = 0; i < 8 && form; i++) { form = form.parentElement; if (form && form.tagName === 'FORM') break }
    const nav = document.querySelector('nav')
    const scrollers = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.clientHeight > 200 }).slice(0, 5).map(e => e.tagName + '.' + [...e.classList].slice(0, 4).join('.'))
    return {
      viewportMeta: document.querySelector('meta[name=viewport]')?.content,
      html: { overflow: getComputedStyle(document.documentElement).overflow, h: document.documentElement.clientHeight },
      body: { overflow: getComputedStyle(document.body).overflow, h: getComputedStyle(document.body).height },
      editor: { tag: ta?.tagName, fontSize: ta && getComputedStyle(ta).fontSize, lineHeight: ta && getComputedStyle(ta).lineHeight, box: box(ta) },
      form: box(form), formRadius: form && getComputedStyle(form.querySelector('div') || form).borderRadius,
      nav: box(nav), scrollers,
    }
  })
  if (w === 1440) fs.writeFileSync(`${out}/all.css`, css.join("\n"))
  await p.screenshot({ path: `${out}/gpt-${w}.png` })
  await ctx.close()
}
fs.writeFileSync(`${out}/measure.json`, JSON.stringify(res, null, 2))
console.log(JSON.stringify(res, null, 1))
await b.close()
