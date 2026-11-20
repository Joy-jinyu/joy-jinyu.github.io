/**
 * 量 AI 产出的 UI：在 375×812 的手机视口里渲染，读计算后的样式和坐标，按评分卡的维度输出 JSON。
 * 用法：node probe.mjs <html 文件> [输出 json]；SCHEME=dark 时按深色模式渲染。依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）
 */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.argv[2])
const outFile = process.argv[3]
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: process.env.SCHEME === 'dark' ? 'dark' : 'light' })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('file://' + file, { waitUntil: 'load' })
await page.waitForTimeout(300)

const src = readFileSync(file, 'utf8')
const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
const cssFacts = {
  transitionAll: /transition\s*:\s*all\b/.test(css),
  outlineNone: /outline\s*:\s*(none|0)\b/.test(css),
  focusVisible: /:focus-visible/.test(css),
  focusRule: /:focus\b(?!-)/.test(css),
  active: /:active/.test(css),
  hoverRules: (css.match(/:hover/g) || []).length,
  hoverInMediaHover: /@media[^{]*\(hover\s*:\s*hover\)/.test(css),
  reducedMotion: /prefers-reduced-motion/.test(css),
  tapHighlight: (css.match(/-webkit-tap-highlight-color\s*:\s*([^;]+)/) || [])[1]?.trim() ?? null,
  tabularNums: /tabular-nums/.test(css),
  safeArea: /safe-area-inset/.test(css),
  vh100: /100vh/.test(css),
  dvh: /\b\d+(dvh|svh)\b/.test(css),
  textWrap: /text-wrap/.test(css),
  cssVars: (css.match(/--[\w-]+\s*:/g) || []).length,
  transitions: [...css.matchAll(/transition\s*:\s*([^;]+)/g)].map((m) => m[1].trim()),
  animations: [...css.matchAll(/animation\s*:\s*([^;]+)/g)].map((m) => m[1].trim()),
  keyframes: (css.match(/@keyframes/g) || []).length,
}

const dom = await page.evaluate(() => {
  const all = [...document.body.querySelectorAll('*')].filter((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !['SCRIPT', 'STYLE'].includes(el.tagName)
  })
  const px = (v) => parseFloat(v) || 0
  const label = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14)
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}「${t}」`
  }
  const spacing = new Map(), fontSizes = new Map(), weights = new Set(), radii = new Map(), textColors = new Set(), bgColors = new Set()
  const add = (m, k, who) => { if (!m.has(k)) m.set(k, []); m.get(k).length < 3 && m.get(k).push(who) }
  for (const el of all) {
    const cs = getComputedStyle(el)
    for (const p of ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap']) {
      const v = px(cs[p]); if (v > 0) add(spacing, v, label(el) + ' ' + p)
    }
    const r = px(cs.borderTopLeftRadius); if (r > 0 && r < 999) add(radii, r, label(el))
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bgColors.add(cs.backgroundColor)
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (hasText) { add(fontSizes, px(cs.fontSize), label(el)); weights.add(cs.fontWeight); textColors.add(cs.color) }
  }

  // 对比度：沿祖先找第一个不透明背景；遇到渐变或图片就标记无法计算
  const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return { img: cs.backgroundImage.slice(0, 40) }; const a = cs.backgroundColor.match(/[\d.]+/g); if (a && (a[3] === undefined || +a[3] > 0.5)) return { color: cs.backgroundColor } } return { color: 'rgb(255, 255, 255)' } }
  const contrast = []
  for (const el of all) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!hasText) continue
    const cs = getComputedStyle(el), bg = bgOf(el)
    if (bg.img) { contrast.push({ who: label(el), ratio: null, bg: bg.img, size: px(cs.fontSize) }); continue }
    const a = lum(cs.color), b = lum(bg.color)
    contrast.push({ who: label(el), ratio: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2), fg: cs.color, bg: bg.color, size: px(cs.fontSize), weight: cs.fontWeight })
  }

  // 嵌套圆角：子元素圆角应 ≤ 父圆角 − 两者间距
  const nested = []
  for (const el of all) {
    const r = px(getComputedStyle(el).borderTopLeftRadius); if (!r || r >= 999) continue
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const pr = px(getComputedStyle(p).borderTopLeftRadius); if (!pr || pr >= 999) continue
      const a = el.getBoundingClientRect(), b = p.getBoundingClientRect()
      const inset = Math.min(a.left - b.left, a.top - b.top)
      if (inset < pr) nested.push({ child: label(el), r, parent: label(p), pr, inset: +inset.toFixed(2), ideal: Math.max(0, +(pr - inset).toFixed(2)) })
      break
    }
  }

  // 点击区域
  const targets = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"], input, [onclick]')]
    .map((el) => { const r = el.getBoundingClientRect(); return { who: label(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1), visible: r.width > 0 } })

  // 文本块左边缘：卡片内带文字的块级元素的 x
  const lefts = new Map()
  for (const el of all) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!hasText) continue
    const range = document.createRange(); range.selectNodeContents(el); const rr = range.getClientRects()[0]; if (!rr) continue
    add(lefts, +rr.left.toFixed(2), label(el))
  }

  // 同一行里图标和文字的垂直中心差
  const rows = []
  for (const el of all) {
    const cs = getComputedStyle(el); if (!cs.display.includes('flex') || cs.flexDirection.startsWith('column')) continue
    const kids = [...el.children].filter((k) => k.getBoundingClientRect().height > 0); if (kids.length < 2) continue
    const mids = kids.map((k) => { const range = document.createRange(); range.selectNodeContents(k); const g = k.textContent.trim() ? range.getBoundingClientRect() : k.getBoundingClientRect(); return { who: label(k), mid: +(g.top + g.height / 2).toFixed(2) } })
    const spread = Math.max(...mids.map((m) => m.mid)) - Math.min(...mids.map((m) => m.mid))
    if (spread > 1) rows.push({ row: label(el), alignItems: cs.alignItems, spread: +spread.toFixed(2), mids })
  }

  const nonInt = all.filter((el) => { const r = el.getBoundingClientRect(); return Math.abs(r.height - Math.round(r.height)) > 0.01 }).slice(0, 8).map((el) => ({ who: label(el), h: +el.getBoundingClientRect().height.toFixed(2) }))
  const text = document.body.innerText

  return {
    spacing: [...spacing.entries()].sort((a, b) => a[0] - b[0]).map(([v, who]) => ({ v, off4: v % 4 !== 0, who })),
    fontSizes: [...fontSizes.entries()].sort((a, b) => a[0] - b[0]).map(([v, who]) => ({ v, who })),
    weights: [...weights], radii: [...radii.entries()].map(([v, who]) => ({ v, who })),
    textColors: [...textColors], bgColors: [...bgColors].length,
    contrast: contrast.sort((a, b) => (a.ratio ?? 99) - (b.ratio ?? 99)).slice(0, 8), nested, targets,
    lefts: [...lefts.entries()].sort((a, b) => a[0] - b[0]).map(([x, who]) => ({ x, who })), rows, nonIntegerHeights: nonInt,
    copy: {
      text: text.replace(/\s+/g, ' ').slice(0, 400),
      cjkLatinNoSpace: (text.match(/[一-鿿][A-Za-z0-9]|[A-Za-z0-9][一-鿿]/g) || []).length,
      halfWidthPunctInCjk: (text.match(/[一-鿿][,.!?:;]/g) || []).length,
      threeDots: text.includes('...'),
    },
  }
})

// 数字：找每秒变化的元素，记录它的宽度变化
const tick = await page.evaluate(async () => {
  const leafs = [...document.body.querySelectorAll('*')].filter((e) => e.children.length === 0 && /\d/.test(e.textContent))
  const before = leafs.map((e) => e.textContent)
  await new Promise((r) => setTimeout(r, 2200))
  const el = leafs.find((e, i) => e.textContent !== before[i]); if (!el) return null
  const widths = []
  for (let i = 0; i < 6; i++) { widths.push(`${el.textContent}@${el.getBoundingClientRect().width.toFixed(2)}`); await new Promise((r) => setTimeout(r, 1050)) }
  const cs = getComputedStyle(el)
  return { numeric: cs.fontVariantNumeric, family: cs.fontFamily.slice(0, 50), widths, rightAligned: cs.textAlign }
})

// 菜单：找「更多」按钮，点开，量动画和行为
const menu = await (async () => {
  const btn = page.locator('button, [role="button"]').filter({ hasText: /更多|⋯|…|•••|\.\.\./ }).first()
  const alt = page.locator('[aria-label*="更多"], [title*="更多"]').first()
  const target = (await btn.count()) ? btn : (await alt.count()) ? alt : null
  if (!target) return { found: false }
  const box = await target.boundingBox()
  const snap = () => page.evaluate(() => {
    const m = [...document.querySelectorAll('*')].find((e) => /重命名/.test(e.textContent) && /删除/.test(e.textContent) && e.querySelectorAll('*').length < 30 && e.children.length >= 2)
    if (!m) return null
    const cs = getComputedStyle(m), r = m.getBoundingClientRect()
    return { tag: m.tagName.toLowerCase() + '.' + (m.className || ''), visible: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.01 && r.height > 0, opacity: cs.opacity, transform: cs.transform, origin: cs.transformOrigin, transition: cs.transition.slice(0, 120), animation: cs.animationName + ' ' + cs.animationDuration, top: +r.top.toFixed(1), right: +r.right.toFixed(1) }
  })
  const closed = await snap()
  await target.click()
  const frames = []
  for (let i = 0; i < 6; i++) { frames.push(await snap()); await page.waitForTimeout(40) }
  await page.waitForTimeout(500)
  const open = await snap()
  const expanded = await target.getAttribute('aria-expanded')
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  const afterEsc = await snap()
  if (afterEsc?.visible) { await page.mouse.click(10, 790); await page.waitForTimeout(400) }
  const afterOutside = await snap()
  // 打断：点开后 60ms 再点一次，采样
  await target.click(); await page.waitForTimeout(60); await target.click()
  const interrupt = []
  for (let i = 0; i < 6; i++) { const s = await snap(); interrupt.push(s && `${(+s.opacity).toFixed(2)}|${s.transform.slice(0, 24)}`); await page.waitForTimeout(40) }
  return { found: true, button: { w: box?.width, h: box?.height }, closed, frames: frames.map((f) => f && `${(+f.opacity).toFixed(2)}|${f.transform.slice(0, 24)}`), open, ariaExpanded: expanded, escCloses: afterEsc ? !afterEsc.visible : null, outsideCloses: afterOutside ? !afterOutside.visible : null, interrupt }
})()

const result = { file, errors, cssFacts, ...dom, tick, menu }
const json = JSON.stringify(result, null, 2)
if (outFile) writeFileSync(outFile, json)
await page.screenshot({ path: file.replace(/\.html$/, process.env.SCHEME === 'dark' ? '-dark.png' : '.png'), fullPage: true })
console.log(json)
await browser.close()
