/**
 * 横屏栏高：iPhone 15 横屏 852×393、用 CDP 模拟安全区（左右 59、下 21），滚动 400px 后量顶栏和底栏在安全区以内占的高度；
 * 每份量两次：原样，和加上「横屏时顶栏不吸顶」的修正（FIX）。
 * 用法：node landscape-bars.mjs；页面从本机预览 http://localhost:4399/blog/lab/ai-h5/ 加载，依赖 playwright-core 和本机 Chrome。
 */
import { chromium } from 'playwright-core'
const FIX = `@media (orientation: landscape) and (max-height: 500px) { .nav { position: static; } }`
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const ins = { top: 0, left: 59, right: 59, bottom: 21 }
for (const f of ['detail1', 'detail2', 'detail3']) for (const fix of [false, true]) {
  const ctx = await b.newContext({ viewport: { width: 852, height: 393 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: ins })
  await p.goto(`http://localhost:4399/blog/lab/ai-h5/${f}.html`, { waitUntil: 'networkidle' })
  if (fix) await p.addStyleTag({ content: FIX })
  await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(300)
  const r = await p.evaluate((ins) => {
    const H = innerHeight, lo = ins.top, hi = H - ins.bottom
    const vis = (el) => { if (!el) return 0; const r = el.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, hi) - Math.max(r.top, lo)) }
    const bottom = [...document.querySelectorAll('body *')].find((e) => getComputedStyle(e).position === 'fixed' && getComputedStyle(e).bottom === '0px' && e.offsetHeight > 30)
    const nav = document.querySelector('.nav')
    return { scrollY, nav: vis(nav), bottom: vis(bottom), safe: hi - lo, sw: document.documentElement.scrollWidth }
  }, ins)
  console.log(f, fix ? 'fix' : 'raw', JSON.stringify(r), ((r.nav + r.bottom) / r.safe * 100).toFixed(1) + '%', 'content', r.safe - r.nav - r.bottom)
  await ctx.close()
}
await b.close()
