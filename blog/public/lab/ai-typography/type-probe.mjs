/**
 * 排版探针：列出页面上每一种文字样式（字号、字重、颜色、对比度、行高、字距），每段文字在哪里折行，
 * 标点实际排出来有多宽，汉字和西文/数字之间有没有空格。
 * 用法：node type-probe.mjs <html 文件> <输出 json> [视口宽，默认 375]；SCHEME=dark 按深色模式。
 * 手机视口、2 倍像素，依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [file, out, w = '375'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const ctx = await browser.newContext({ viewport: { width: Number(w), height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: process.env.SCHEME === 'dark' ? 'dark' : 'light' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('file://' + resolve(file), { waitUntil: 'load' })
await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
await page.waitForTimeout(400)

const data = await page.evaluate(() => {
  const HAN = /[㐀-鿿豈-﫿]/
  const LAT = /[A-Za-z0-9]/
  const PUNCT = '“”‘’，。、：；！？（）《》—…·「」'
  const px = (v) => parseFloat(v) || 0
  const rgba = (c) => {
    const p = c.match(/\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number) ?? [0, 0, 0, 0]
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  // 往上找第一层不透明的背景色；半透明的一层层叠上去
  // 中途遇到渐变或图片背景时记一笔：这时算出来的对比度不可信
  const bgOf = (el) => {
    const layers = []
    let img = false
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.backgroundImage !== 'none') img = true
      const c = rgba(cs.backgroundColor)
      if (c.a > 0) { layers.push(c); if (c.a >= 1) break }
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 }
    for (const c of layers.reverse()) acc = over(c, acc)
    return { ...acc, img }
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
  const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  const shown = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || px(cs.opacity) === 0) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const sel = (el) => el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].join('.') : '')

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.data.trim() && !n.parentElement.closest('script,style,svg,noscript') && shown(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  })
  const nodes = []
  for (let n; (n = walker.nextNode()); ) nodes.push(n)

  // 每个字符一个 Range：拿到它排出来的盒子（宽 = 这个字实际占的宽度）
  const chars = (node) => {
    const res = []
    const rg = document.createRange()
    for (let i = 0; i < node.data.length; i++) {
      rg.setStart(node, i); rg.setEnd(node, i + 1)
      const r = [...rg.getClientRects()].find((q) => q.width > 0 || q.height > 0)
      if (r) res.push({ ch: node.data[i], x: r.left, y: r.top, w: r.width, h: r.height })
    }
    return res
  }

  // 一、样式清单：按直接装着文字的那个元素算
  const styles = []
  const seen = new Set()
  for (const n of nodes) {
    const el = n.parentElement
    if (seen.has(el)) continue
    seen.add(el)
    const cs = getComputedStyle(el)
    const fg = rgba(cs.color)
    const bg = bgOf(el)
    const text = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.data).join('').replace(/\s+/g, ' ').trim()
    const r = el.getBoundingClientRect()
    styles.push({
      sel: sel(el), text,
      fs: px(cs.fontSize), fw: Number(cs.fontWeight), lh: cs.lineHeight === 'normal' ? 'normal' : px(cs.lineHeight),
      ls: cs.letterSpacing, color: hex(over(fg, bg)), alpha: fg.a, bg: hex(bg), bgImage: bg.img, contrast: Math.round(ratio(over(fg, bg), bg) * 100) / 100,
      ff: cs.fontFamily, ta: cs.textAlign, tw: cs.textWrap ?? cs.textWrapStyle, tt: cs.textTransform,
      autospace: cs.textAutospace ?? null, trim: cs.textSpacingTrim ?? null, lb: cs.lineBreak, wb: cs.wordBreak,
      x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
    })
  }

  // 二、折行：按最近的块级祖先把文字收拢成段，再按字符的纵坐标分行
  const blockOf = (el) => { for (let e = el; e; e = e.parentElement) { const d = getComputedStyle(e).display; if (!d.startsWith('inline') && d !== 'contents') return e } return document.body }
  const blocks = new Map()
  for (const n of nodes) {
    const b = blockOf(n.parentElement)
    if (!blocks.has(b)) blocks.set(b, [])
    blocks.get(b).push(...chars(n))
  }
  const paras = []
  for (const [b, cs] of blocks) {
    const lines = []
    for (const c of cs) {
      const mid = c.y + c.h / 2
      const line = lines.find((l) => Math.abs(l.mid - mid) < c.h * 0.4)
      if (line) line.cs.push(c); else lines.push({ mid, cs: [c] })
    }
    lines.sort((a, b2) => a.mid - b2.mid)
    const fs = px(getComputedStyle(b).fontSize)
    paras.push({
      sel: sel(b), fs, width: Math.round(b.getBoundingClientRect().width),
      lines: lines.map((l) => l.cs.sort((a, b2) => a.x - b2.x).map((c) => c.ch).join('')),
    })
  }

  // 三、标点和汉字/西文交界：标点实际宽度（em），交界处有没有空格
  const punct = []
  const bounds = []
  for (const n of nodes) {
    const fs = px(getComputedStyle(n.parentElement).fontSize)
    const cs = chars(n)
    cs.forEach((c, i) => {
      if (PUNCT.includes(c.ch)) punct.push({ ch: c.ch, em: Math.round((c.w / fs) * 1000) / 1000, ctx: cs.slice(Math.max(0, i - 3), i + 4).map((q) => q.ch).join(''), sel: sel(n.parentElement) })
    })
    const t = n.data
    for (let i = 0; i < t.length - 1; i++) {
      const a = t[i], b = t[i + 1]
      if ((HAN.test(a) && LAT.test(b)) || (LAT.test(a) && HAN.test(b))) bounds.push({ pair: a + b, space: false, ctx: t.slice(Math.max(0, i - 3), i + 5) })
      if (i < t.length - 2 && b === ' ' && ((HAN.test(a) && LAT.test(t[i + 2])) || (LAT.test(a) && HAN.test(t[i + 2])))) bounds.push({ pair: a + t[i + 2], space: true, ctx: t.slice(Math.max(0, i - 3), i + 6) })
    }
  }

  const root = getComputedStyle(document.documentElement)
  return {
    lang: document.documentElement.lang || null,
    viewport: document.querySelector('meta[name=viewport]')?.content ?? null,
    bodyFont: getComputedStyle(document.body).fontFamily,
    rootFs: px(root.fontSize),
    styles, paras, punct, bounds,
  }
})
data.file = file.split('/').pop()
data.width = Number(w)
data.errors = errors
writeFileSync(out, JSON.stringify(data, null, 1))
await browser.close()
console.log(`${data.file}: ${data.styles.length} 处文字样式，${data.paras.length} 段，${data.punct.length} 个标点，${data.bounds.length} 处汉字/西文交界`)
