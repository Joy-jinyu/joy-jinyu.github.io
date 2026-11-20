/**
 * 间距 X 光：量页面上每段文字、每个图标真正画出来的像素（墨迹）在哪，以及每个看得见的盒子的边在哪。
 * 用法：node xray.mjs <html 文件> <输出 json> [全页截图 png]；SCHEME=dark 按深色模式。
 * 375 宽的手机视口（先按 812 高打开，再拉到页面高度）、2 倍像素。依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 * 做法：先截一张全页图；再逐个把一段文字（或一个图标、一个伪元素）设成透明，截同一块区域，
 * 和全页图逐像素比，变了的像素就是它的墨迹。量的是眼睛看到的东西，不是 CSS 盒子。
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [file, out, shotFile] = process.argv.slice(2)
const DPR = 2
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, colorScheme: process.env.SCHEME === 'dark' ? 'dark' : 'light' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('file://' + resolve(file), { waitUntil: 'load' })
// 关掉过渡和光标闪烁，前后两张截图才能逐像素对得上
await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}[data-xh-pseudo]::before,[data-xh-pseudo]::after{visibility:hidden!important}[data-xh-ph]::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}' })
await page.waitForTimeout(400)
// 视口拉到和页面一样高，整页一次画完：长截图会把固定定位的导航栏在底部再画一遍
const fullH = await page.evaluate(() => document.documentElement.scrollHeight)
if (fullH > 812) { await page.setViewportSize({ width: 375, height: fullH }); await page.waitForTimeout(200) }

const found = await page.evaluate(() => {
  const px = (v) => parseFloat(v) || 0
  const alpha = (c) => {
    if (!c || c === 'transparent') return 0
    const p = c.match(/\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean) ?? []
    return p.length > 3 ? parseFloat(p[3]) : 1
  }
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || px(cs.opacity) === 0) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }
  const R = (r) => ({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height })
  const name = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''
    return el.tagName.toLowerCase() + cls
  }
  const effBg = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor
      if (alpha(c) > 0) return c
    }
    return 'rgb(255, 255, 255)'
  }
  let id = 0
  const atoms = []
  const tag = (el) => el.dataset.xh || (el.dataset.xh = String(++id))
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName) || !shown(el)) continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    // 直接挂在这个元素下的文字：一个元素算一段
    const texts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
    if (texts.length) {
      const rects = texts.flatMap((t) => { const g = document.createRange(); g.selectNodeContents(t); return [...g.getClientRects()] })
      const top = Math.min(...rects.map((q) => q.top)), bottom = Math.max(...rects.map((q) => q.bottom))
      const left = Math.min(...rects.map((q) => q.left)), right = Math.max(...rects.map((q) => q.right))
      const lh = cs.lineHeight === 'normal' ? null : px(cs.lineHeight)
      // 只装文字的块级元素：内容盒就是行盒（被 text-box 裁过也算得对）；
      // 裁过又补了 padding 的，padding 是用来包住墨迹的，算边框盒。
      // 其余情况：字体内容区上下各补半个行距；多行时取首行顶和末行底
      const leafBlock = el.children.length === 0 && cs.display !== 'inline'
      const trimmed = cs.textBoxTrim && cs.textBoxTrim !== 'none'
      const inset = trimmed ? [0, 0] : [px(cs.borderTopWidth) + px(cs.paddingTop), px(cs.borderBottomWidth) + px(cs.paddingBottom)]
      const half = lh ? (lh - rects[0].height) / 2 : 0
      const line = leafBlock
        ? { x: left + scrollX, y: r.top + inset[0] + scrollY, w: right - left, h: r.height - inset[0] - inset[1] }
        : { x: left + scrollX, y: top - half + scrollY, w: right - left, h: bottom - top + 2 * half }
      atoms.push({
        kind: 'text', el: tag(el), who: name(el), text: texts.map((t) => t.textContent.trim()).join(' '),
        lineBox: line,
        region: { x: left + scrollX - 6, y: top - half + scrollY - 6, w: right - left + 12, h: bottom - top + 2 * half + 12 },
        font: { size: px(cs.fontSize), lineHeight: lh, weight: cs.fontWeight, family: cs.fontFamily.split(',')[0].trim(), color: cs.color },
      })
    }
    if (el.matches('input, textarea') && el.placeholder && !el.value) {
      atoms.push({ kind: 'placeholder', el: tag(el), who: name(el), text: el.placeholder, region: R(r), font: { size: px(cs.fontSize), lineHeight: cs.lineHeight === 'normal' ? null : px(cs.lineHeight), family: cs.fontFamily.split(',')[0].trim() } })
    }
    if (el.matches('svg:not(svg *), img, canvas')) atoms.push({ kind: 'icon', el: tag(el), who: name(el), text: el.getAttribute('aria-label') || '', region: { x: r.left + scrollX - 3, y: r.top + scrollY - 3, w: r.width + 6, h: r.height + 6 } })
    const pseudo = ['::before', '::after'].filter((p) => { const s = getComputedStyle(el, p); return s.content && s.content !== 'none' && s.display !== 'none' })
    if (pseudo.length) atoms.push({ kind: 'pseudo', el: tag(el), who: name(el) + pseudo.join(''), text: '', region: { x: r.left + scrollX - 24, y: r.top + scrollY - 24, w: r.width + 48, h: r.height + 48 } })
    // 看得见的盒子：底色和外面不同、有边框或有投影。记下哪几条边看得见
    if (el !== document.body) {
      const bgOn = alpha(cs.backgroundColor) > 0 && cs.backgroundColor !== effBg(el.parentElement) || cs.backgroundImage !== 'none'
      const shadow = cs.boxShadow !== 'none'
      const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => px(cs[`border${s}Width`]) > 0 && alpha(cs[`border${s}Color`]) > 0 && cs[`border${s}Style`] !== 'none')
      if (bgOn || shadow || sides.length) atoms.push({ kind: 'box', el: tag(el), who: name(el), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24), rect: R(r), fill: bgOn || shadow, sides: sides.map((s) => s.toLowerCase()), radius: px(cs.borderTopLeftRadius), bg: cs.backgroundColor })
    }
  }
  return { atoms, page: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight } }
})

// 截图解码放在一个空白页里做，避免往被测页面里塞东西
const dec = await ctx.newPage()
const decode = (buf) => dec.evaluate(async (b64) => {
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob()
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(bmp, 0, 0)
  return { w: bmp.width, h: bmp.height, d: Array.from(g.getImageData(0, 0, bmp.width, bmp.height).data) }
}, buf.toString('base64'))

const full = await page.screenshot({ fullPage: true })
if (shotFile) writeFileSync(shotFile, full)
const base = await decode(full)

// 逐个隐藏：文字把自己设成透明，但子元素和伪元素的颜色先钉住，只让它自己的字消失
const hide = (a) => page.evaluate(({ el, kind }) => {
  const e = document.querySelector(`[data-xh="${el}"]`)
  const saved = [e, ...e.querySelectorAll('*')].map((n) => [n, n.getAttribute('style')])
  window.__xh = saved
  if (kind === 'icon') e.style.setProperty('visibility', 'hidden', 'important')
  else if (kind === 'pseudo') e.setAttribute('data-xh-pseudo', '')
  else if (kind === 'placeholder') e.setAttribute('data-xh-ph', '')
  else {
    const pin = (n) => { const c = getComputedStyle(n); n.style.setProperty('color', c.color, 'important'); n.style.setProperty('-webkit-text-fill-color', c.webkitTextFillColor, 'important') }
    e.querySelectorAll('*').forEach(pin)
    const c = getComputedStyle(e)
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) e.style.setProperty(`border-${s.toLowerCase()}-color`, c[`border${s}Color`], 'important')
    e.style.setProperty('background-color', c.backgroundColor, 'important')
    e.style.setProperty('outline-color', c.outlineColor, 'important')
    const pc = ['::before', '::after'].map((p) => getComputedStyle(e, p).color)
    const st = document.getElementById('xh-dyn') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'xh-dyn' }))
    st.textContent = `[data-xh="${el}"]::before{color:${pc[0]}!important;-webkit-text-fill-color:${pc[0]}!important}[data-xh="${el}"]::after{color:${pc[1]}!important;-webkit-text-fill-color:${pc[1]}!important}`
    e.style.setProperty('color', 'transparent', 'important')
    e.style.setProperty('-webkit-text-fill-color', 'transparent', 'important')
    e.style.setProperty('text-shadow', 'none', 'important')
  }
}, a)
const show = (a) => page.evaluate(({ el }) => {
  const e = document.querySelector(`[data-xh="${el}"]`)
  for (const [n, s] of window.__xh) s == null ? n.removeAttribute('style') : n.setAttribute('style', s)
  e.removeAttribute('data-xh-pseudo'); e.removeAttribute('data-xh-ph')
  const st = document.getElementById('xh-dyn'); if (st) st.textContent = ''
}, a)

const clamp = (r) => {
  const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y))
  return { x, y, width: Math.min(found.page.w, Math.ceil(r.x + r.w)) - x, height: Math.min(found.page.h, Math.ceil(r.y + r.h)) - y }
}
const round = (v) => Math.round(v * DPR) / DPR
for (const a of found.atoms.filter((a) => a.kind !== 'box')) {
  const clip = clamp(a.region)
  await hide(a)
  const img = await decode(await page.screenshot({ fullPage: true, clip }))
  await show(a)
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4, j = ((clip.y * DPR + y) * base.w + clip.x * DPR + x) * 4
    if (Math.max(Math.abs(img.d[i] - base.d[j]), Math.abs(img.d[i + 1] - base.d[j + 1]), Math.abs(img.d[i + 2] - base.d[j + 2])) > 12) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
  a.ink = x1 < 0 ? null : { x: round(clip.x + x0 / DPR), y: round(clip.y + y0 / DPR), w: round((x1 - x0 + 1) / DPR), h: round((y1 - y0 + 1) / DPR) }
  delete a.region
}

const result = { file: file.split('/').pop(), browser: browser.version(), viewport: '375x812@2x', scheme: process.env.SCHEME === 'dark' ? 'dark' : 'light', page: found.page, errors, atoms: found.atoms.filter((a) => a.kind === 'box' || a.ink) }
writeFileSync(out, JSON.stringify(result, null, 1))
console.log(`${result.file}: ${result.atoms.length} atoms (${found.atoms.filter((a) => a.kind !== 'box' && !a.ink).length} 个没有墨迹被丢掉), page ${found.page.w}x${found.page.h}, errors ${errors.length}`)
await browser.close()
