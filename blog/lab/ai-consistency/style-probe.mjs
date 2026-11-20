/**
 * 风格探针：列出页面上实际画出来的颜色（文字、背景、边框）、圆角、阴影、字号、字重、控件高度，
 * 每个值记下用到它的元素个数和前几个元素，用来和参考页、设计变量比对。
 * 用法：node style-probe.mjs <html 文件> <输出 json>；SCHEME=dark 按深色模式。
 * 手机视口 375 宽、2 倍像素，依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'

const [file, out] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: process.env.SCHEME === 'dark' ? 'dark' : 'light' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('file://' + resolve(file), { waitUntil: 'load' })
await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
await page.waitForTimeout(400)

const data = await page.evaluate(() => {
  const hex = (c) => {
    const p = c.match(/\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (!p) return null
    const [r, g, b, a = 1] = p
    if (a === 0) return null
    const h = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
    return a < 1 ? `${h}/${+a.toFixed(2)}` : h
  }
  const label = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14)
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}${t ? `「${t}」` : ''}`
  }
  const bag = {}
  const add = (k, v, el) => {
    if (v == null || v === '') return
    bag[k] ??= {}
    const e = (bag[k][v] ??= { n: 0, who: [] })
    e.n++
    if (e.who.length < 4) e.who.push(label(el))
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    // 1px 以下的是读屏专用的隐藏元素（sr-only），不算画出来的
    if (r.width <= 1 || r.height <= 1) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0 && !el.closest('[hidden],dialog:not([open])')
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName)) continue
    const cs = getComputedStyle(el)
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (own) {
      add('text', hex(cs.color), el)
      add('fontSize', parseFloat(cs.fontSize), el)
      add('fontWeight', cs.fontWeight, el)
    }
    if (el.tagName === 'svg' || el.closest('svg')) {
      if (el.tagName === 'svg') { add('icon', hex(cs.color), el); add('iconSize', `${Math.round(el.getBoundingClientRect().width)}`, el) }
      continue
    }
    add('bg', hex(cs.backgroundColor), el)
    if (cs.backgroundImage !== 'none') add('bgImage', cs.backgroundImage.slice(0, 80), el)
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none') add('border', `${parseFloat(cs[`border${s}Width`])}px ${hex(cs[`border${s}Color`])}`, el)
    }
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius]
    if (rad.some((v) => parseFloat(v) > 0)) {
      const r = el.getBoundingClientRect()
      // 圆角大于等于短边一半的是胶囊或圆形，单独记成 pill
      const v = parseFloat(rad[0]) >= Math.min(r.width, r.height) / 2 - 0.5 ? 'pill' : [...new Set(rad.map((x) => parseFloat(x)))].join('/')
      add('radius', v, el)
    }
    if (cs.boxShadow !== 'none') add('shadow', cs.boxShadow.replace(/rgba?\([^)]+\)/g, (m) => hex(m) ?? m), el)
    if (el.matches('button, a[href], input, select, textarea, [role="button"], [role="tab"], summary')) {
      add('controlHeight', `${Math.round(el.getBoundingClientRect().height)}`, el)
    }
  }
  const vars = {}
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText === ':root' || rule.selectorText === 'html') for (const p of rule.style) if (p.startsWith('--')) vars[p] = getComputedStyle(document.documentElement).getPropertyValue(p).trim()
      }
    } catch {}
  }
  const cssText = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
  return {
    bag,
    vars,
    darkRule: /prefers-color-scheme:\s*dark/.test(cssText),
    literalColorsOutsideRoot: (cssText.replace(/:root\s*\{[^}]*\}/g, '').match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) ?? []).length,
  }
})
writeFileSync(out, JSON.stringify({ file: basename(file), scheme: process.env.SCHEME ?? 'light', ...data, errors }, null, 1))
await browser.close()
