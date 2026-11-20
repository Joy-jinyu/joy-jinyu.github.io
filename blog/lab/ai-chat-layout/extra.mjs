// 补测：常显滚动条下的居中偏移；输入框阴影是否被裁；手机上收起的抽屉能否被 Tab 聚焦。node extra.mjs run1.html
import { chromium } from 'playwright-core'
import path from 'node:path'
const file = process.argv[2]
const url = 'file://' + path.resolve(file)
// 无头 Chrome 默认隐藏滚动条；关掉 overlay 滚动条后是 15px 的常显滚动条，和 Windows 上一样占宽度
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-features=OverlayScrollbar'], ignoreDefaultArgs: ['--hide-scrollbars'] })
const out = {}

// 1. 常显滚动条下，消息列和输入框的左右边差多少（1440、1024 两个宽度）
out.classicScrollbar = {}
for (const width of [1440, 1024]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage()
  await page.goto(url)
  await page.waitForTimeout(300)
  out.classicScrollbar[width] = await page.evaluate(() => {
    let s = document.querySelector('.msg').parentElement
    while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement
    const colEl = document.querySelector('.msg').parentElement
    const cs = getComputedStyle(colEl)
    const col = colEl.getBoundingClientRect()
    const l = col.left + parseFloat(cs.paddingLeft), r = col.right - parseFloat(cs.paddingRight)
    const comp = document.querySelector('.composer').getBoundingClientRect()
    return { scrollbarW: s.offsetWidth - s.clientWidth, left: +(comp.left - l).toFixed(1), right: +(comp.right - r).toFixed(1), centerOffset: +((comp.left + comp.right) / 2 - (l + r) / 2).toFixed(1) }
  })
  if (width === 1440) await page.screenshot({ path: file.replace('.html', '-scrollbar.png') })
}

// 3. 输入框的外阴影会不会被外层裁掉（外层 overflow 不是 visible 时才会裁）
out.shadowClip = {}
for (const [width, mobile] of [[1440, false], [390, true]]) {
  const page = await (await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile })).newPage()
  await page.goto(url)
  await page.waitForTimeout(300)
  out.shadowClip[width] = await page.evaluate(() => {
    const comp = document.querySelector('.composer')
    const wrap = comp.parentElement
    const shadows = getComputedStyle(comp).boxShadow
    if (shadows === 'none') return { shadow: 'none' }
    // 「rgba(0, 0, 0, 0.06) 0px 4px 16px 0px」→ 偏移、模糊、扩展
    const ext = { top: 0, bottom: 0, left: 0, right: 0 }
    for (const part of shadows.split(/,(?![^(]*\))/)) {
      const [x, y, blur = 0, spread = 0] = (part.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat)
      ext.top = Math.max(ext.top, blur + spread - y); ext.bottom = Math.max(ext.bottom, blur + spread + y)
      ext.left = Math.max(ext.left, blur + spread - x); ext.right = Math.max(ext.right, blur + spread + x)
    }
    const c = comp.getBoundingClientRect(), w = wrap.getBoundingClientRect()
    const clips = getComputedStyle(wrap).overflow !== 'visible'
    const cut = (v) => +Math.max(0, v).toFixed(1)
    return { shadow: shadows, wrapOverflow: getComputedStyle(wrap).overflow, clipped: clips ? { top: cut(w.top - (c.top - ext.top)), bottom: cut(c.bottom + ext.bottom - w.bottom), left: cut(w.left - (c.left - ext.left)), right: cut(c.right + ext.right - w.right) } : null }
  })
}

// 2. 手机宽度，抽屉收起时连按 Tab，看焦点会不会落进看不见的侧边栏
{
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
  await page.goto(url)
  await page.waitForTimeout(400)
  const hits = []
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    const h = await page.evaluate(() => { const a = document.activeElement; const inSide = document.querySelector('#sidebar').contains(a); const r = a.getBoundingClientRect(); return inSide ? { text: a.textContent.trim().slice(0, 12), left: Math.round(r.left) } : null })
    if (h) hits.push(h)
  }
  out.tabIntoHiddenDrawer = { count: hits.length, first: hits.slice(0, 3) }
}
console.log(JSON.stringify(out))
await browser.close()
